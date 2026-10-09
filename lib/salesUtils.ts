import { supabaseAdmin } from './supabase'

/**
 * 商品銷量：product_id → 賣出件數（不含已取消的訂單）。
 *
 * 用在首頁、賣場、商品頁、文章與自測的商品推薦。
 *
 * 以前是把整張 order_items 與 orders 讀回來在這裡加總，但 Supabase 每次最多
 * 只回 1000 列 —— 訂單明細超過一千筆之後，後面的都沒算到，「N 人買過」
 * 越來越偏低；已取消的訂單也只認得前一千筆。
 *
 * 現在優先讀資料庫的 product_sales 檢視（migrations/product_sales_view.sql），
 * 加總在資料庫裡做，一個商品回一列。檢視還沒建立時退回逐頁讀明細，
 * 結果一樣正確，只是比較慢。
 */
const PAGE = 1000
type Db = typeof supabaseAdmin

/** 讀 product_sales 檢視；檢視不存在或查詢失敗回傳 null，由呼叫端改用備援 */
async function readSalesView(db: Db, productId?: number): Promise<Record<number, number> | null> {
  const map: Record<number, number> = {}
  for (let from = 0; ; from += PAGE) {
    let query = db.from('product_sales').select('product_id, sold').order('product_id').range(from, from + PAGE - 1)
    if (productId !== undefined) query = query.eq('product_id', productId)
    const { data, error } = await query
    if (error) return null
    for (const row of (data || []) as any[]) map[row.product_id] = Number(row.sold) || 0
    if (!data || data.length < PAGE) return map
  }
}

/** 備援：逐頁讀訂單明細，連同訂單狀態一起帶回來，排除已取消 */
async function sumFromItems(db: Db, productId?: number): Promise<Record<number, number>> {
  const map: Record<number, number> = {}
  for (let from = 0; ; from += PAGE) {
    let query = db.from('order_items')
      .select('id, product_id, quantity, orders!inner(order_status)')
      .neq('orders.order_status', '已取消')
      .order('id').range(from, from + PAGE - 1)
    if (productId !== undefined) query = query.eq('product_id', productId)
    const { data, error } = await query
    if (error) return map
    for (const item of (data || []) as any[]) {
      if (item.product_id == null) continue
      map[item.product_id] = (map[item.product_id] || 0) + (Number(item.quantity) || 0)
    }
    if (!data || data.length < PAGE) return map
  }
}

export async function buildSalesMap(db: Db = supabaseAdmin): Promise<Record<number, number>> {
  return (await readSalesView(db)) ?? (await sumFromItems(db))
}

/** 單一商品的銷量（不含已取消的訂單） */
export async function getSalesCountForProduct(productId: number, db: Db = supabaseAdmin): Promise<number> {
  const map = (await readSalesView(db, productId)) ?? (await sumFromItems(db, productId))
  return map[productId] || 0
}

/**
 * Display threshold — only show "已售 X 件" when N >= this value.
 * Below this, suppress the badge (avoids weak social proof signals).
 */
export const SALES_DISPLAY_THRESHOLD = 5

export function formatSalesCount(count: number): string | null {
  if (count < SALES_DISPLAY_THRESHOLD) return null
  if (count >= 1000) return `已售 ${(count / 1000).toFixed(1)}K+ 件`
  if (count >= 100) return `🔥 熱銷 ${count} 件`
  return `已售 ${count} 件`
}
