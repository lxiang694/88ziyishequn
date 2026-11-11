/**
 * 首頁第一屏「最近大家都在買」挑哪三件 —— 純函式，不碰資料庫。
 *
 * 以前照累計銷量排，前三名幾乎不會變，常回來的客人每次都看到同樣三件。
 * 現在看最近 7 天：有幾張訂單買了這件商品（同一張訂單買 10 盒只算 1 次，
 * 避免一張大訂單洗版）。最近 7 天湊不滿時用累計熱銷補位，第一屏永遠有貨。
 *
 * 只挑有封面圖、有庫存的商品 —— 第一屏推一件按了加不進購物車的商品，比不推更糟。
 */
export const TRENDING_DAYS = 7

export interface TrendRow { order_id: number; product_id: number | null }

export function pickTrending<P extends { id: number; cover_image_url: string | null; product_variants: { is_active: boolean; stock_qty: number }[] }>(
  products: P[],        // 已照累計銷量由高到低排好
  recentRows: TrendRow[],
  n = 3,
): { ids: number[]; label: string } {
  const eligible = products.filter(p => p.cover_image_url && p.product_variants.some(v => v.is_active && v.stock_qty > 0))
  const allTimeRank = new Map(eligible.map((p, i) => [p.id, i]))

  // 最近 7 天：每件商品出現在幾張不同的訂單
  const seen = new Set<string>()
  const recent = new Map<number, number>()
  for (const r of recentRows) {
    if (r.product_id == null || !allTimeRank.has(r.product_id)) continue
    const key = `${r.order_id}:${r.product_id}`
    if (seen.has(key)) continue
    seen.add(key)
    recent.set(r.product_id, (recent.get(r.product_id) || 0) + 1)
  }
  const recentIds = [...recent.keys()]
    .sort((a, b) => recent.get(b)! - recent.get(a)! || allTimeRank.get(a)! - allTimeRank.get(b)!)
    .slice(0, n)

  const ids = [...recentIds]
  for (const p of eligible) {
    if (ids.length >= n) break
    if (!ids.includes(p.id)) ids.push(p.id)
  }
  // 三件都是最近 7 天賣出的才寫「最近」，有補位就不寫，標題要符合事實
  const label = recentIds.length >= Math.min(n, ids.length) && ids.length > 0 ? '最近大家都在買' : '大家都在買'
  return { ids, label }
}
