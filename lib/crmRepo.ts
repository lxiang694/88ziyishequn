import { supabaseAdmin } from './supabase'
import type { CustomerOrder } from './crm'

const BATCH = 1000
const MAX_ROWS = 100_000

/** 分批讀完整張表（PostgREST 一次最多 1000 筆） */
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<{ rows: T[]; ok: boolean }> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { data, error } = await build(from, from + BATCH - 1)
    if (error) return { rows, ok: false }
    rows.push(...(data || []))
    if (!data || data.length < BATCH) break
  }
  return { rows, ok: true }
}

/** 一般訂單＋團購訂單（不含已取消），整理成同一種格式 */
export async function loadCustomerOrders(): Promise<{ orders: CustomerOrder[]; groupBuyIncluded: boolean }> {
  const [shop, gb] = await Promise.all([
    readAll<any>((from, to) => supabaseAdmin.from('orders')
      .select('phone, customer_name, line_id, total_amount, created_at, order_items(product_name_snapshot)')
      .neq('order_status', '已取消').order('id').range(from, to)),
    readAll<any>((from, to) => supabaseAdmin.from('group_buy_orders')
      .select('phone, customer_name, total_amount, created_at, group_buy_order_items(name_snapshot)')
      .neq('status', '已取消').order('id').range(from, to)),
  ])
  if (!shop.ok) throw new Error('讀取訂單失敗')
  const orders: CustomerOrder[] = [
    ...shop.rows.map(o => ({
      phone: o.phone, customer_name: o.customer_name, line_id: o.line_id, total_amount: Number(o.total_amount) || 0,
      created_at: o.created_at, source: 'shop' as const,
      items: (o.order_items || []).map((i: any) => i.product_name_snapshot).filter(Boolean),
    })),
    // 團購表還沒建（沒跑 group_buy_schema.sql）時就只算一般訂單
    ...(gb.ok ? gb.rows : []).map(o => ({
      phone: o.phone, customer_name: o.customer_name, line_id: null, total_amount: Number(o.total_amount) || 0,
      created_at: o.created_at, source: 'group_buy' as const,
      items: (o.group_buy_order_items || []).map((i: any) => i.name_snapshot).filter(Boolean),
    })),
  ]
  return { orders, groupBuyIncluded: gb.ok }
}

export interface ContactRow { phone: string; list_key: string; note: string | null; admin_name: string | null; contacted_at: string }

/** 每位客人最近一次聯繫；資料表還沒建時回傳 ready:false */
export async function loadLatestContacts(): Promise<{ ready: boolean; latest: Map<string, ContactRow> }> {
  const { rows, ok } = await readAll<ContactRow>((from, to) => supabaseAdmin.from('customer_contacts')
    .select('phone, list_key, note, admin_name, contacted_at').order('contacted_at', { ascending: false }).range(from, to))
  const latest = new Map<string, ContactRow>()
  for (const r of rows) if (!latest.has(r.phone)) latest.set(r.phone, r)
  return { ready: ok, latest }
}
