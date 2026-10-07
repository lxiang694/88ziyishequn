import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json } from '@/lib/myship/server'
import { validateLabelResults } from '@/lib/myship/localLabelAssistant'

export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const transfers: any[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('myship_transfers')
        .select('id,external_order_no,marketplace_id,import_row').eq('status', 'confirmed')
        .order('id').range(offset, offset + 499)
      if (error) throw new Error('無法讀取已成立的賣貨便訂單')
      transfers.push(...(data || []))
      if (!data || data.length < 500) break
    }
    const receipts: any[] = []
    let setupRequired = false
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('myship_label_receipts')
        .select('order_no,status,warnings,verification,created_at').order('created_at', { ascending: false }).order('id').range(offset, offset + 499)
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') { setupRequired = true; break }
        throw new Error('面單紀錄暫時無法讀取')
      }
      receipts.push(...(data || []))
      if (!data || data.length < 500) break
    }
    // A later pending attempt must not hide a previous successful upload.
    receipts.sort((a, b) => Number(b.status === 'uploaded') - Number(a.status === 'uploaded'))
    return json({ transfers, receipts, setupRequired })
  } catch (e) { return failure(e instanceof Error ? e.message : '讀取失敗', 500) }
}

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = await req.text()
    if (raw.length > 500000) throw new Error('面單結果資料過大')
    const body = JSON.parse(raw)
    if (!uuid.test(body.requestId || '')) throw new Error('批次識別不正確')
    if (body.action === 'handoff') {
      const ids = Array.isArray(body.transferIds) ? [...new Set(body.transferIds)] : []
      const nos = Array.isArray(body.orderNos) ? [...new Set(body.orderNos)] : []
      if (Math.max(ids.length, nos.length) < 1 || Math.max(ids.length, nos.length) > 500) throw new Error('請選擇 1 至 500 筆訂單')
      if (nos.length && nos.some(no => typeof no !== 'string' || !/^CM\d{13}$/.test(no))) throw new Error('CM 訂單格式不正確')
      let query = supabaseAdmin.from('myship_transfers').select('id,external_order_no').eq('status', 'confirmed')
      query = nos.length ? query.in('external_order_no', nos) : query.in('id', ids)
      const { data, error } = await query
      if (error) throw new Error('無法核對所選訂單')
      const confirmed = [...new Set((data || []).map(t => t.external_order_no))]
      if (confirmed.length !== (nos.length || ids.length) || confirmed.some(no => !/^CM\d{13}$/.test(no))) {
        throw new Error('部分訂單尚未核對 CM 編號，請先完成轉單')
      }
      // 已上傳成功的訂單在這裡跳過，不只靠畫面停用勾選：面單處理頁是直接貼
      // 訂單號送出，沒有勾選框可以擋。重複上傳會在新比銳產生兩筆面單。
      const { data: done, error: doneError } = await supabaseAdmin.from('myship_label_receipts')
        .select('order_no').eq('status', 'uploaded').in('order_no', confirmed)
      if (doneError) throw new Error('請先執行 migrations/myship_label_assistant.sql 啟用面單紀錄')
      const skipped = [...new Set((done || []).map(r => r.order_no as string))]
      const orderNos = confirmed.filter(no => !skipped.includes(no))
      if (!orderNos.length) throw new Error('所選訂單都已上傳過面單，不再重複送出')
      const { error: insertError } = await supabaseAdmin.from('myship_label_requests').upsert({
        id: body.requestId, order_nos: orderNos, created_by: auth.admin.id,
      }, { onConflict: 'id', ignoreDuplicates: true })
      if (insertError) throw new Error('請先執行 migrations/myship_label_assistant.sql 啟用面單紀錄')
      const { data: saved, error: savedError } = await supabaseAdmin.from('myship_label_requests')
        .select('order_nos,created_by').eq('id', body.requestId).single()
      if (savedError || !saved || saved.created_by !== auth.admin.id ||
        saved.order_nos.length !== orderNos.length || saved.order_nos.some((no: string) => !orderNos.includes(no))) {
        throw new Error('此送單識別已用於另一批訂單')
      }
      return json({ requestId: body.requestId, orderNos, skipped })
    }
    if (body.action === 'results') {
      const { data: batch, error } = await supabaseAdmin.from('myship_label_requests')
        .select('order_nos,created_by').eq('id', body.requestId).single()
      if (error || !batch || batch.created_by !== auth.admin.id) throw new Error('找不到你送出的批次')
      const results = validateLabelResults(body.results, batch.order_nos)
      if (!results.length) throw new Error('助手尚未回報結果')
      const { error: saveError } = await supabaseAdmin.from('myship_label_receipts').upsert(results.map(r => ({
        request_id: body.requestId, order_no: r.orderNo, status: r.status, pdf_sha256: r.sha256,
        tracking: r.tracking, carrier: r.carrier, progress: r.progress, verification: r.verification,
        warnings: r.warnings,
      })), { onConflict: 'request_id,order_no' })
      if (saveError) throw new Error('面單結果回填失敗，請確認資料庫遷移')
      return json({ saved: results.length, uploaded: results.filter(r => r.status === 'uploaded').length })
    }
    throw new Error('操作方式不正確')
  } catch (e) { return failure(e instanceof Error ? e.message : '送單失敗') }
}
