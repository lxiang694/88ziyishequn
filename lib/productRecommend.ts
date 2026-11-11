/**
 * 商品頁底部「你可能也會喜歡」的排序 —— 純函式，不碰資料庫。
 *
 * 要推的是「這位客人可能也想買的」，所以訊號的輕重是：
 *
 *   1. 常一起買：別的客人在同一張訂單裡，除了這件還買了什麼。
 *      這是真實的購買行為，最準，權重最大。
 *   2. 同一個商品分類（賣場分類，例如「日常保健」「居家用品」）。
 *   3. 同一個健康訴求（骨關節、助眠…）。
 *   4. 銷量：前面都一樣時，賣得好的排前面；也是新商品、還沒有
 *      訂單時的退路 —— 至少推的是大家真的有在買的東西。
 *
 * 一定排除：這件商品本身、買不到的（售完、沒有價格）。
 * 推一件按了加不進購物車的商品，比少推一件更糟。
 */
import { isInStock, lowestActivePrice } from './productPricing'

export interface RecSignals {
  /** 商品 id → 跟這件商品出現在同一張訂單的次數 */
  coBought: Map<number, number>
  /** 跟這件商品同賣場分類的商品 id */
  sameShop: Set<number>
  /** 跟這件商品同健康訴求的商品 id */
  sameHealth: Set<number>
  /** 商品 id → 銷量 */
  sales: Record<number, number>
}

export type RecReason = 'together' | 'similar' | 'popular'

export interface Recommendation<P> {
  product: P
  reason: RecReason
}

export const REC_COUNT = 6

/** 至少幾張訂單一起買過，才標「常一起買」（一張可能只是巧合） */
const TOGETHER_MIN = 2

export function rankRecommendations<P extends { id: number; product_variants?: any[] }>(
  currentId: number,
  candidates: P[],
  s: RecSignals,
  n = REC_COUNT,
): Recommendation<P>[] {
  const scored = candidates
    .filter(p => p.id !== currentId && isInStock(p) && lowestActivePrice(p) !== null)
    .map(p => {
      const together = s.coBought.get(p.id) || 0
      const similar = s.sameShop.has(p.id) || s.sameHealth.has(p.id)
      const score =
        together * 20 +
        (s.sameShop.has(p.id) ? 30 : 0) +
        (s.sameHealth.has(p.id) ? 15 : 0) +
        // 銷量只當同分時的排序，上限 10 分，不會蓋過「同類」
        Math.min(10, Math.log10(1 + (s.sales[p.id] || 0)) * 4)
      const reason: RecReason = together >= TOGETHER_MIN ? 'together' : similar ? 'similar' : 'popular'
      return { product: p, reason, score }
    })
    .sort((a, b) => b.score - a.score || a.product.id - b.product.id)

  return scored.slice(0, n).map(({ product, reason }) => ({ product, reason }))
}

/** 同一張訂單裡的其他商品各出現在幾張訂單（同一張訂單重複列只算一次） */
export function countCoBought(currentId: number, rows: { order_id: number; product_id: number | null }[]): Map<number, number> {
  const seen = new Set<string>()
  const out = new Map<number, number>()
  for (const r of rows) {
    if (r.product_id == null || r.product_id === currentId) continue
    const key = `${r.order_id}:${r.product_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.set(r.product_id, (out.get(r.product_id) || 0) + 1)
  }
  return out
}
