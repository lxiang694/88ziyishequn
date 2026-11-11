/**
 * 賣場商品排序 —— 純函式。
 *
 * 台灣的購物網站（蝦皮、momo、PChome）都有「熱銷／最新／價格」排序，
 * 客人很習慣先按價格由低到高比價。
 *
 * 不管哪一種排序，售完的商品一律排到最後：賣很好但剛好售完的商品
 * 排在第一個，客人點了買不到，只會覺得白跑一趟。
 */
import { lowestActivePrice, isInStock } from './productPricing'

export type ShopSort = 'hot' | 'new' | 'price_asc' | 'price_desc'

export const SHOP_SORTS: { key: ShopSort; label: string }[] = [
  { key: 'hot', label: '熱銷' },
  { key: 'new', label: '最新' },
  { key: 'price_asc', label: '價格↑' },
  { key: 'price_desc', label: '價格↓' },
]

interface Sortable { id: number; sales_count?: number; created_at?: string; product_variants?: any[] }

export function sortShopProducts<P extends Sortable>(products: P[], sort: ShopSort): P[] {
  const time = (p: P) => (p.created_at ? new Date(p.created_at).getTime() : 0) || 0
  const price = (p: P) => lowestActivePrice(p)
  const cmp = (a: P, b: P): number => {
    switch (sort) {
      case 'new': return time(b) - time(a)
      case 'price_asc': return (price(a) ?? Infinity) - (price(b) ?? Infinity)
      case 'price_desc': return (price(b) ?? -Infinity) - (price(a) ?? -Infinity)
      default: return (b.sales_count || 0) - (a.sales_count || 0)
    }
  }
  return [...products].sort((a, b) =>
    Number(isInStock(b)) - Number(isInStock(a)) || cmp(a, b) || (b.sales_count || 0) - (a.sales_count || 0) || a.id - b.id)
}

/**
 * 劃線原價：最便宜那個可購買規格的原價，比售價高才顯示。
 * 用同一個規格的原價，不拿別的規格湊 —— 「NT$360 起，原價 NT$1,200」
 * 如果 1,200 是三瓶組的原價，就是誤導。
 */
export function strikePrice(product: { product_variants?: any[] }): number | null {
  const buyable = (product.product_variants || []).filter((v: any) => v.is_active && v.stock_qty > 0 && v.sale_price > 0)
  const list = buyable.length ? buyable : (product.product_variants || []).filter((v: any) => v.is_active && v.sale_price > 0)
  if (!list.length) return null
  const cheapest = list.reduce((a: any, b: any) => (b.sale_price < a.sale_price ? b : a))
  return typeof cheapest.original_price === 'number' && cheapest.original_price > cheapest.sale_price ? cheapest.original_price : null
}
