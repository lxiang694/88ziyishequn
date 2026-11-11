'use client'

/**
 * 商品頁底部「你可能也會喜歡」—— 6 件推薦商品，可以直接加入購物車。
 *
 * 推哪 6 件由伺服器算好（lib/productRecommend.ts）：常一起買 > 同類 > 熱銷。
 *
 * 卡片刻意比首頁的 ProductCard 小：這裡是「順手再帶一件」，不是逛賣場，
 * 手機兩欄、桌機三欄，一屏看得到大半。按鈕在價格下面一整條，
 * 不跟價格擠同一列（窄螢幕會把「NT$580 起」截掉，見 ProductCard 的說明）。
 *
 * 多規格的商品不幫客人預選規格，跳出規格面板讓客人自己選 ——
 * 跟商品頁本身的規則一致，避免買錯規格。
 */
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from './CartContext'
import VariantPicker from './VariantPicker'
import { formatPrice } from '@/lib/utils'
import { lowestActivePrice, buyableVariants } from '@/lib/productPricing'
import type { RecReason } from '@/lib/productRecommend'

export interface RecProduct {
  id: number
  product_name: string
  slug: string
  cover_image_url: string | null
  product_variants: any[]
}

export type RecItem = { product: RecProduct; reason: RecReason }

export default function ProductRecommendations({ items }: { items: RecItem[] }) {
  const { addItem } = useCart()
  const [picker, setPicker] = useState<RecProduct | null>(null)
  if (items.length === 0) return null

  const add = (p: RecProduct) => {
    const buyable = buyableVariants(p)
    if (buyable.length === 0) return
    if (buyable.length > 1) { setPicker(p); return }
    const v = buyable[0]
    addItem({
      product_id: p.id, product_name: p.product_name, product_slug: p.slug,
      cover_image_url: p.cover_image_url, variant_id: v.id, variant_name: v.variant_name,
      sku_code: v.sku_code, unit_price: v.sale_price, quantity: 1, stock_qty: v.stock_qty,
    })
  }

  const anyTogether = items.some(i => i.reason === 'together')

  return (
    <section className="mt-8" aria-labelledby="rec-heading">
      <h2 id="rec-heading" className="text-[19px] font-bold text-gray-900">你可能也會喜歡</h2>
      <p className="mb-3 mt-0.5 text-sm text-gray-600">
        {anyTogether ? '買這件的客人，也常一起帶這些' : '同類好物，可以一起下單'}
      </p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {items.map(({ product: p, reason }) => {
          const price = lowestActivePrice(p)
          const buyable = buyableVariants(p)
          const multi = buyable.length > 1
          // 規格都同價（例如護膝 M／L）就不寫「起」
          const priceVaries = new Set(buyable.map((v: any) => v.sale_price)).size > 1
          return (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <Link href={`/products/${p.slug}`} className="relative block aspect-square bg-gray-50">
                {p.cover_image_url ? (
                  <Image src={p.cover_image_url} alt={p.product_name} fill className="object-cover"
                    sizes="(max-width: 640px) 50vw, 240px" />
                ) : (
                  <span className="flex h-full items-center justify-center text-4xl text-gray-200">💊</span>
                )}
                {reason === 'together' && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[12px] font-bold text-white">
                    常一起買
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-2.5">
                <Link href={`/products/${p.slug}`}
                  className="line-clamp-2 min-h-[2.75em] text-[15px] font-bold leading-snug text-gray-800 hover:text-green-700">
                  {p.product_name}
                </Link>
                <p className="mt-1 whitespace-nowrap text-[17px] font-bold text-green-700">
                  {price !== null ? formatPrice(price) : ''}
                  {priceVaries && <span className="ml-0.5 text-[13px] font-normal text-gray-500">起</span>}
                </p>
                <button type="button" onClick={() => add(p)}
                  className="mt-2 min-h-[42px] w-full rounded-xl border-2 border-green-700 text-[15px] font-bold text-green-700 active:bg-green-50">
                  {multi ? '選規格' : '＋ 加入購物車'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {picker && (
        <VariantPicker
          product={{ id: picker.id, product_name: picker.product_name, product_slug: picker.slug,
            cover_image_url: picker.cover_image_url, short_intro: null, product_variants: picker.product_variants }}
          preselect={false}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  )
}
