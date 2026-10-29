import { NextRequest, NextResponse } from 'next/server'
import { isDeepStrictEqual } from 'node:util'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure } from '@/lib/myship/server'
import { snapshot, staleStoreCodes, type TransferOrder, type ImportRow } from '@/lib/myship/domain'
import { buildWorkbook } from '@/lib/myship/workbook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(params.id)) return failure('批次編號錯誤')
  try {
    const { data, error } = await supabaseAdmin.from('myship_transfers').select('*').eq('batch_id', params.id).order('order_id')
    if (error) return failure('讀取批次失敗', 500)
    if (!data?.length) return failure('找不到批次', 404)
    // 部分已確認的批次不再提供整批重下載，以免再次匯入已成立的訂單。
    if (data.some(t => t.status !== 'exported')) return failure('此批次已有成功或解除保留的訂單，不可重新下載整批', 409)
    // 團購訂單：用資料庫算的快照比對（與保留時存下的同一個函式）
    const gbRows = data.filter(t => t.source === 'group_buy')
    if (gbRows.length) {
      const { data: snaps, error: snapError } = await supabaseAdmin.rpc('myship_group_buy_snapshots', { p_ids: gbRows.map(t => t.group_buy_order_id) })
      if (snapError) return failure('無法核對原團購訂單', 500)
      for (const t of gbRows) {
        const current = (snaps as { id: number; snapshot: unknown }[] | null)?.find(x => x.id === t.group_buy_order_id)
        if (!current || !isDeepStrictEqual(current.snapshot, t.snapshot)) return failure('原團購訂單已變更，請人工核對此批次', 409)
      }
    }
    const shopRows = data.filter(t => t.source !== 'group_buy')
    if (shopRows.length) {
      const { data: orders, error: orderError } = await supabaseAdmin.from('orders').select('*, order_items(*)').in('id', shopRows.map(t => t.order_id))
      if (orderError) return failure('無法核對原訂單', 500)
      for (const t of shopRows) {
        const order = orders?.find(o => o.id === t.order_id)
        if (!order || !isDeepStrictEqual(snapshot(order as TransferOrder), t.snapshot)) return failure('原訂單已變更，請人工核對此批次', 409)
      }
    }
    // 建立批次後才改過門市店號：存下的檔案還是舊店號，賣貨便會說查無此編號。擋下並說明怎麼重做。
    const storeOf = new Map<string, number | null>()
    if (shopRows.length) {
      const { data: rows } = await supabaseAdmin.from('orders').select('id, store_id').in('id', shopRows.map(t => t.order_id))
      for (const r of rows || []) storeOf.set(`shop:${r.id}`, r.store_id)
    }
    if (gbRows.length) {
      const { data: rows } = await supabaseAdmin.from('group_buy_orders').select('id, store_id').in('id', gbRows.map(t => t.group_buy_order_id))
      for (const r of rows || []) storeOf.set(`gb:${r.id}`, r.store_id)
    }
    const storeIdOf = (t: any) => storeOf.get(t.source === 'group_buy' ? `gb:${t.group_buy_order_id}` : `shop:${t.order_id}`) ?? null
    const storeIds = [...new Set(data.map(storeIdOf).filter((v): v is number => !!v))]
    if (storeIds.length) {
      const { data: stores } = await supabaseAdmin.from('stores_711').select('id, store_code').in('id', storeIds)
      const stale = staleStoreCodes(data.map(t => ({ import_row: t.import_row, store_id: storeIdOf(t) })), new Map((stores || []).map(s => [s.id, s.store_code])))
      if (stale.length) {
        const list = stale.slice(0, 3).map(s => `${s.marker}（檔案裡是 ${s.was}，現在是 ${s.now}）`).join('；')
        return failure(`門市店號在建立這批之後改過，這批檔案還是舊店號，賣貨便會說查無此編號：${list}。請在批次紀錄對這筆按「核對」→「未匯入或明確失敗」解除保留，再回待處理訂單重新匯出，新檔案就會用新店號。`, 409)
      }
    }
    const file = await buildWorkbook(data.map(t => t.import_row as ImportRow))
    return new NextResponse(Buffer.from(file), { headers: {
      'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      'Content-Disposition': `attachment; filename="myship-${params.id}.xlsm"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch { return failure('匯出檔案失敗，批次仍保留，請稍後重試', 500) }
}
