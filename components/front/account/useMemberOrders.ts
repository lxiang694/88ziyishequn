'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useUserAuth } from '@/components/front/UserAuthContext'
import { useCart } from '@/components/front/CartContext'
import type { MemberOrder } from '@/lib/memberOrders'

export interface CatalogItem {
  product_id: number; product_name: string; slug: string; cover_image_url: string | null
  variant_id: number; variant_name: string; sku_code: string | null; sale_price: number; stock_qty: number
}
export interface RebuyItem extends CatalogItem { times: number }
export interface ReviewableItem { product_id: number; product_name: string; slug: string; cover_image_url: string | null }

/** 會員中心共用：讀訂單、常買商品、待評價；加入購物車用「現在」的價格與庫存 */
export function useMemberOrders(enabled: boolean) {
  const { authedFetch } = useUserAuth()
  const { addItem } = useCart()
  const [orders, setOrders] = useState<MemberOrder[]>([])
  const [rebuy, setRebuy] = useState<RebuyItem[]>([])
  const [reviewable, setReviewable] = useState<ReviewableItem[]>([])
  const [catalog, setCatalog] = useState<Record<number, CatalogItem>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const d = await (await authedFetch('/api/account/orders')).json()
      if (d.success) { setOrders(d.data); setRebuy(d.rebuy || []); setReviewable(d.reviewable || []); setCatalog(d.catalog || {}) }
    } catch {}
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { if (enabled) reload() }, [enabled, reload])

  const addToCart = (c: CatalogItem, quantity = 1) => {
    if (c.stock_qty <= 0) return false
    addItem({
      product_id: c.product_id, product_name: c.product_name, product_slug: c.slug, cover_image_url: c.cover_image_url,
      variant_id: c.variant_id, variant_name: c.variant_name, sku_code: c.sku_code, unit_price: c.sale_price,
      quantity: Math.min(quantity, c.stock_qty), stock_qty: c.stock_qty,
    })
    return true
  }

  /** 整張訂單再買一次：還買得到的加進購物車，下架或缺貨的告訴客人 */
  const reorder = (o: MemberOrder) => {
    let added = 0, skipped = 0
    for (const it of o.items) {
      const c = it.variant_id ? catalog[it.variant_id] : undefined
      if (c && addToCart(c, it.quantity)) added++
      else skipped++
    }
    // 每加一樣購物車會自己跳提示；這裡只補充買不到的
    if (added && skipped) toast(`有 ${skipped} 樣已下架或缺貨，沒有加入`, { icon: 'ℹ️' })
    else if (!added) toast.error('這張訂單的商品目前都買不到了（已下架或缺貨）')
    return added > 0
  }

  return { orders, rebuy, reviewable, catalog, loading, reload, addToCart, reorder }
}
