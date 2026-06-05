import { supabaseAdmin } from './supabase'

/**
 * Build a map of product_id → total quantity sold,
 * automatically excluding orders with status '已取消'.
 *
 * Used by:
 *   • homepage product list (sorting + display)
 *   • /api/products listing
 *   • product detail page (single product display)
 *   • sleep / article smart product matchers
 */
export async function buildSalesMap(): Promise<Record<number, number>> {
  const [{ data: items }, { data: orders }] = await Promise.all([
    supabaseAdmin.from('order_items').select('product_id, quantity, order_id'),
    supabaseAdmin.from('orders').select('id, order_status'),
  ])

  const cancelledOrderIds = new Set(
    (orders || [])
      .filter((o: any) => o.order_status === '已取消')
      .map((o: any) => o.id)
  )

  const map: Record<number, number> = {}
  for (const item of (items || []) as any[]) {
    if (!cancelledOrderIds.has(item.order_id)) {
      map[item.product_id] = (map[item.product_id] || 0) + item.quantity
    }
  }
  return map
}

/**
 * Get the total sold count for a single product (post-cancellation filter).
 */
export async function getSalesCountForProduct(productId: number): Promise<number> {
  const [{ data: items }, { data: orders }] = await Promise.all([
    supabaseAdmin
      .from('order_items')
      .select('quantity, order_id')
      .eq('product_id', productId),
    supabaseAdmin.from('orders').select('id, order_status'),
  ])

  const cancelledOrderIds = new Set(
    (orders || [])
      .filter((o: any) => o.order_status === '已取消')
      .map((o: any) => o.id)
  )

  let total = 0
  for (const item of (items || []) as any[]) {
    if (!cancelledOrderIds.has(item.order_id)) {
      total += item.quantity
    }
  }
  return total
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
