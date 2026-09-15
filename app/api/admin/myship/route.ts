import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, loadContext } from '@/lib/myship/server'
import { prepareOrder } from '@/lib/myship/domain'

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
    const reserved = new Set<number>()
    for (let i = 0; i < context.orders.length; i += 200) {
      const { data, error: e } = await supabaseAdmin.from('myship_transfers').select('order_id').neq('status', 'released').in('order_id', context.orders.slice(i, i + 200).map(o => o.id))
      if (e) throw new Error('無法讀取轉單狀態')
      for (const r of data || []) reserved.add(r.order_id)
    }
    const orders = context.orders.map(order => ({
      ...prepareOrder(order, context.mappings, context.markets, context.stores.find(s => s.id === order.store_id)),
      customer_name: order.customer_name, total_amount: order.total_amount, store_name: order.store_name,
      reserved: reserved.has(order.id),
      items: order.order_items.map(i => ({ variant_id: i.variant_id, name: i.product_name_snapshot, variant: i.variant_name_snapshot, sku: i.sku_snapshot })),
    }))
    return json({ orders, markets: context.markets, mappings: context.mappings, transfers: transfers || [] })
  } catch (e) { return failure(e instanceof Error ? e.message : '讀取失敗', 500) }
}
