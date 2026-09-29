import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, loadContext } from '@/lib/myship/server'
import { prepareOrderParts } from '@/lib/myship/domain'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const context = await loadContext()
    const { data: confirmed, error } = await supabaseAdmin.from('myship_transfers')
      .select('id,order_id,marketplace_id,batch_id,status,external_order_no,created_at,import_row')
      .in('status', ['confirmed', 'released']).order('created_at', { ascending: false }).limit(100)
    if (error) throw new Error('請先完成轉單資料庫遷移')
    const transfers = [...(confirmed || [])]
    for (let offset = 0; ; offset += 500) {
      const { data, error: e } = await supabaseAdmin.from('myship_transfers')
        .select('id,order_id,marketplace_id,batch_id,status,external_order_no,created_at,import_row')
        .eq('status', 'exported').order('id').range(offset, offset + 499)
      if (e) throw new Error('讀取待核對批次失敗')
      transfers.push(...(data || []))
      if (!data || data.length < 500) break
    }
    transfers.sort((a, b) => b.created_at.localeCompare(a.created_at))
    // 保留全部待處理訂單的轉單識別，不能只依最近500筆判斷。
    //
    // 按「訂單＋賣場」記，不是只按訂單。拆單的訂單會在兩個賣場各有一筆轉單；
    // 只按訂單記的話，A 賣場那半一匯出，整張訂單就被當成已保留，切到 B 賣場
    // 時另一半會從清單消失，永遠匯不出去。
    const reserved = new Set<string>()
    const key = (orderId: number, marketplaceId: string | null) => `${orderId}:${marketplaceId}`
    for (let i = 0; i < context.orders.length; i += 200) {
      const { data, error: e } = await supabaseAdmin.from('myship_transfers').select('order_id,marketplace_id').neq('status', 'released').in('order_id', context.orders.slice(i, i + 200).map(o => o.id))
      if (e) throw new Error('無法讀取轉單狀態')
      for (const r of data || []) reserved.add(key(r.order_id, r.marketplace_id))
    }
    // 資料庫還沒跑 myship_split_orders.sql 時，拆單訂單建立批次一定會被舊的
    // 檢查擋下。與其讓它在清單上顯示「可匯出」、按了才失敗，不如先標出原因。
    // 用 limit 0 只探測欄位存不存在，讀不到也只是當成還沒更新，不影響整頁。
    const { error: splitProbe } = await supabaseAdmin.from('myship_transfers').select('part_count').limit(0)
    const splitReady = !splitProbe
    const marketOf = new Map(context.mappings.map(m => [m.variant_id, m.marketplace_id]))
    // 一張訂單拆成幾張，這裡就回傳幾列，每列屬於一個賣場。畫面依賣場篩選，
    // 所以每個賣場的清單裡只會看到屬於它的那一半。
    const orders = context.orders.flatMap(order => {
      const parts = prepareOrderParts(order, context.mappings, context.markets, context.stores.find(s => s.id === order.store_id))
      return parts.map(p => ({
        ...p,
        ...(p.parts > 1 && !splitReady && !p.errors.length
          ? { errors: ['跨賣場拆單尚未啟用：請先在 Supabase 執行 migrations/myship_split_orders.sql'], row: null }
          : {}),
        customer_name: order.customer_name, store_name: order.store_name,
        // 代收金額欄顯示的是「這一張」要收的錢；沒拆單時就等於訂單總額
        total_amount: p.amount,
        order_total: order.total_amount,
        reserved: reserved.has(key(order.id, p.marketplace_id)),
        // 拆單時只列出這一張的商品，看的人才知道這個賣場要寄什麼
        items: order.order_items
          .filter(i => p.parts === 1 || marketOf.get(i.variant_id as number) === p.marketplace_id)
          .map(i => ({ variant_id: i.variant_id, name: i.product_name_snapshot, variant: i.variant_name_snapshot, sku: i.sku_snapshot })),
      }))
    })
    return json({ orders, markets: context.markets, mappings: context.mappings, transfers: transfers || [] })
  } catch (e) { return failure(e instanceof Error ? e.message : '讀取失敗', 500) }
}
