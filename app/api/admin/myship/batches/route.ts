import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, loadContext, readBody } from '@/lib/myship/server'
import { parseIds, prepareOrder, snapshot, type ImportRow } from '@/lib/myship/domain'
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
    const context = await loadContext()
    const entries = ids.map(id => {
      const order = context.orders.find(o => o.id === id)
      if (!order) throw new Error('訂單已不是待確認，請重新整理')
      const prepared = prepareOrder(order, context.mappings, context.markets, context.stores.find(s => s.id === order.store_id))
      if (prepared.errors.length) throw new Error(`${order.order_no}：${prepared.errors.join('；')}`)
      return { order_id: id, marketplace_id: prepared.marketplace_id, row: prepared.row!, snapshot: snapshot(order) }
    })
    if (new Set(entries.map(e => e.marketplace_id)).size !== 1) return failure('每批請只選擇同一個賣場')
    // 範本缺失或檔案格式問題先回報，避免先保留一個無法下載的批次。
    await buildWorkbook(entries.map(e => e.row as ImportRow))
    const { error } = await supabaseAdmin.rpc('myship_reserve_batch', { p_batch_id: body.batch_id, p_entries: entries, p_admin_id: auth.admin.id })
    if (error) return failure('部分訂單已匯出或資料已變更，請重新整理並查看批次紀錄', 409)
    await writeAuditLog(req, auth.admin, 'myship.export', `batch=${body.batch_id};count=${entries.length}`)
    return json({ batch_id: body.batch_id })
  } catch (e) { return failure(e instanceof Error ? e.message : '建立批次失敗') }
}
