import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, loadContext, readBody } from '@/lib/myship/server'
import { parseIds, prepareOrderParts, snapshot, isMarketplaceId, type ImportRow } from '@/lib/myship/domain'
import { buildWorkbook } from '@/lib/myship/workbook'
import { writeAuditLog } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    const ids = parseIds(body.order_ids)
    if (typeof body.batch_id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.batch_id)) return failure('批次編號格式錯誤')
    const { data: existing, error: readError } = await supabaseAdmin.from('myship_transfers').select('order_id').eq('batch_id', body.batch_id)
    if (readError) return failure('讀取批次失敗', 500)
    if (existing?.length) {
      if (existing.map(t => t.order_id).sort((a, b) => a - b).join(',') !== ids.join(',')) return failure('此批次已用於其他訂單', 409)
      return json({ batch_id: body.batch_id })
    }
    // 賣場代碼是選填：舊版助手（0.2.7 以前）不會帶，只要選的都是單一賣場的
    // 訂單就照舊處理。拆單的訂單一定要帶，因為同一張訂單在不同賣場各有一半，
    // 不知道是哪個賣場就不知道該匯出哪一半。
    const requestedMarket = body.marketplace_id
    if (requestedMarket !== undefined && !isMarketplaceId(requestedMarket)) return failure('賣場代碼格式錯誤')

    const context = await loadContext()
    const entries = ids.map(id => {
      const order = context.orders.find(o => o.id === id)
      if (!order) throw new Error('訂單已不是待確認，請重新整理')
      const parts = prepareOrderParts(order, context.mappings, context.markets, context.stores.find(s => s.id === order.store_id))
      let prepared
      if (requestedMarket) {
        prepared = parts.find(p => p.marketplace_id === requestedMarket)
        if (!prepared) throw new Error(`${order.order_no}：這張訂單沒有屬於此賣場的商品`)
      } else if (parts.length === 1) {
        prepared = parts[0]
      } else {
        throw new Error(`${order.order_no}：這是跨賣場拆單的訂單，請更新賣貨便助手至 0.2.8，或改用網頁上的「建立並下載匯入檔」`)
      }
      if (prepared.errors.length) throw new Error(`${order.order_no}：${prepared.errors.join('；')}`)
      return {
        order_id: id, marketplace_id: prepared.marketplace_id, row: prepared.row!, snapshot: snapshot(order),
        // 資料庫會用這兩個值再驗一次：拆成幾張要跟商品實際分屬的賣場數一致，
        // 同一張訂單已匯出的其他半也必須是用同樣的拆法（見 myship_split_orders.sql）
        part_no: prepared.part, part_count: prepared.parts,
      }
    })
    if (new Set(entries.map(e => e.marketplace_id)).size !== 1) return failure('每批請只選擇同一個賣場')
    // 範本缺失或檔案格式問題先回報，避免先保留一個無法下載的批次。
    await buildWorkbook(entries.map(e => e.row as ImportRow))
    const { error } = await supabaseAdmin.rpc('myship_reserve_batch', { p_batch_id: body.batch_id, p_entries: entries, p_admin_id: auth.admin.id })
    if (error) {
      // 拆單在資料庫還沒更新前一定會被舊的檢查擋下（那是安全的失敗）。
      // 這時給明確的原因，不要讓人以為是資料變了而一直重新整理。
      const hasSplit = entries.some(e => e.part_count > 1)
      const hint = hasSplit && /配對|duplicate|unique|myship_transfers_active/i.test(error.message || '')
        ? '。若這批包含拆單訂單，請先在 Supabase 執行 migrations/myship_split_orders.sql'
        : ''
      return failure('部分訂單已匯出或資料已變更，請重新整理並查看批次紀錄' + hint, 409)
    }
    await writeAuditLog(req, auth.admin, 'myship.export', `batch=${body.batch_id};count=${entries.length}`)
    return json({ batch_id: body.batch_id })
  } catch (e) { return failure(e instanceof Error ? e.message : '建立批次失敗') }
}
