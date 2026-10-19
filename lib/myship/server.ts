import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/adminMiddleware'
import { supabaseAdmin } from '@/lib/supabase'
import type { TransferOrder, Marketplace, Mapping, PickupStore } from './domain'
import type { GroupBuyTransferOrder } from './groupBuy'

export function authorize(req: NextRequest) {
  const auth = requirePermission(req, 'orders.transfer')
  if (auth instanceof NextResponse) return auth
  if (req.method !== 'GET' && (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')) {
    return NextResponse.json({ error: '請從本站後台操作' }, { status: 403 })
  }
  return auth
}
export function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}
export function json(data: unknown) {
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
export async function readBody(req: NextRequest) {
  const raw = await req.text()
  if (raw.length > 50000) throw new Error('請求資料過大')
  return JSON.parse(raw)
}

// Supabase預設單次最多1000列，必須分頁；穩定id排序避免遺漏後頁。
async function collect(table: string, select = '*', pending = false) {
  const rows: any[] = []
  for (let offset = 0; ; offset += 500) {
    let query = supabaseAdmin.from(table).select(select).order(table === 'myship_variant_mappings' ? 'variant_id' : 'id').range(offset, offset + 499)
    if (pending) query = query.eq('order_status', '待確認')
    const { data, error } = await query
    if (error) throw new Error('無法讀取轉單資料，請確認資料庫遷移與連線')
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}
export async function loadContext() {
  const [orders, markets, mappings] = await Promise.all([
    collect('orders', '*, order_items(*)', true), collect('myship_marketplaces'), collect('myship_variant_mappings'),
  ])
  const ids = [...new Set(orders.map(o => o.store_id).filter(Boolean))]
  const stores: PickupStore[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('stores_711').select('id, store_code, store_name, address, is_active').in('id', ids.slice(i, i + 200))
    if (error) throw new Error('無法讀取門市資料')
    stores.push(...(data || []))
  }
  return { orders: orders as TransferOrder[], markets: markets as Marketplace[], mappings: mappings as Mapping[], stores }
}

// ── 團購訂單 ─────────────────────────────────────────────

/** myship_group_buy.sql 執行過了沒（看轉單表有沒有 group_buy_order_id 欄位） */
export async function groupBuyTransfersReady(): Promise<boolean> {
  const { error } = await supabaseAdmin.from('myship_transfers').select('group_buy_order_id').limit(0)
  return !error
}

const GROUP_BUY_ORDER_COLUMNS = 'id, order_no, campaign_id, customer_name, phone, shipping_method, store_id, store_name, store_address, note, subtotal, shipping_fee, total_amount, status, created_at, group_buy_order_items(id, name_snapshot, spec_snapshot, unit_price, quantity, subtotal)'

/** 待出貨、7-11 取貨的團購訂單，附檔期名稱與門市。團購資料表不存在時回傳空的 */
export async function loadGroupBuyContext(ids?: number[]) {
  const orders: GroupBuyTransferOrder[] = []
  for (let offset = 0; ; offset += 500) {
    let query = supabaseAdmin.from('group_buy_orders').select(GROUP_BUY_ORDER_COLUMNS)
      .eq('status', '待出貨').in('shipping_method', ['711', '711_normal']).order('id').range(offset, offset + 499)
    if (ids) query = query.in('id', ids)
    const { data, error } = await query
    if (error) return { orders: [], campaigns: new Map<number, string>(), stores: [] as PickupStore[] }
    orders.push(...((data || []) as unknown as GroupBuyTransferOrder[]))
    if (!data || data.length < 500) break
  }
  const campaignIds = [...new Set(orders.map(o => o.campaign_id))]
  const campaigns = new Map<number, string>()
  if (campaignIds.length) {
    const { data } = await supabaseAdmin.from('group_buy_campaigns').select('id, title').in('id', campaignIds)
    for (const c of data || []) campaigns.set(c.id, c.title)
  }
  const storeIds = [...new Set(orders.map(o => o.store_id).filter((v): v is number => !!v))]
  const stores: PickupStore[] = []
  for (let i = 0; i < storeIds.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('stores_711').select('id, store_code, store_name, address, is_active').in('id', storeIds.slice(i, i + 200))
    if (error) throw new Error('無法讀取門市資料')
    stores.push(...(data || []))
  }
  return { orders, campaigns, stores }
}
