'use client'

/**
 * 商品卡 —— 首頁與賣場分類頁共用。
 *
 * 原本這段寫在 HomeClient 裡面，新增 /shop 時照抄一份的話，兩邊的價格
 * 顯示、售完遮罩、規格數這些規則就會開始各走各的。價格是會出錯的東西，
 * 只留一份。
 */

import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { lowestActivePrice, isInStock, buyableVariants, activeVariantCount } from '@/lib/productPricing'

export interface CardProduct {
  id: number
  product_name: string
  slug: string
  short_intro: string | null
  cover_image_url: string | null
  product_variants: any[]
  sales_count?: number
  shop_categories?: { id: number; name: string; slug: string; emoji: string }[]
  product_category_relations?: { health_categories: any }[]
}

interface Props {
  product: CardProduct
  /** 熱銷名次，只有前三名會顯示角標；不傳就不顯示 */
  rank?: number
  onAddToCart: (product: CardProduct) => void
  /** 分類標籤顯示哪一套。賣場頁顯示商品分類，首頁沿用原本的健康方向 */
  tagSource?: 'shop' | 'health'
  healthIcons?: Record<string, string>
}

export default function ProductCard({
  product, rank, onAddToCart, tagSource = 'shop', healthIcons = {},
}: Props) {
  const minPrice = lowestActivePrice(product)
  const inStock = isInStock(product)
  const isMulti = buyableVariants(product).length > 1
  const variantCount = activeVariantCount(product)

  const tags = tagSource === 'shop'
    ? (product.shop_categories || []).map(c => ({ id: c.id, name: c.name, icon: c.emoji }))
    : (product.product_category_relations || [])
        .map(r => r.health_categories).filter(Boolean)
        .map((c: any) => ({ id: c.id, name: c.name, icon: healthIcons[c.slug] || '' }))

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200 flex flex-col">
      <Link href={`/products/${product.slug}`} className="block relative">
        <div className="aspect-square bg-gray-50 relative overflow-hidden">
          {product.cover_image_url ? (
            <Image src={product.cover_image_url} alt={product.product_name} fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">💊</div>
          )}
          {/* 純裝飾角標：熱銷名次 */}
          {rank !== undefined && rank < 3 && (
            <span className="absolute top-2 left-2 bg-red-600 text-white t-badge-deco font-bold px-2 py-1 rounded-md">熱銷 {rank + 1}</span>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-gray-900/80 text-white text-base font-bold px-4 py-2 rounded-full">已售完</span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.slice(0, 1).map(tag => (
              <span key={tag.id} className="t-meta bg-green-50 text-green-800 px-2.5 py-1 rounded-full font-semibold border border-green-100">
                {tag.icon} {tag.name}
              </span>
            ))}
          </div>
        )}
        <Link href={`/products/${product.slug}`}>
          <h3 className="t-product-title mb-1 hover:text-green-700 line-clamp-3">{product.product_name}</h3>
        </Link>
        {product.short_intro && (
          <p className="t-meta leading-relaxed mb-2 line-clamp-2 hidden sm:block">{product.short_intro}</p>
        )}
        {/* 價格（大、紅）→ 規格數（小、灰）→ CTA → 已購買人數（小、灰、置中） */}
        <div className="mt-auto pt-2 space-y-2">
          {minPrice !== null && (
            <div>
              <div className="t-price">
                {formatPrice(minPrice)}{isMulti ? ' 起' : ''}
              </div>
              {variantCount > 1 && (
                <div className="t-price-note mt-0.5">共 {variantCount} 種規格可選</div>
              )}
            </div>
          )}
          <button onClick={() => onAddToCart(product)} disabled={!inStock} className="btn-card">
            {!inStock ? '已售完' : isMulti ? '選擇規格' : '加入購物車'}
          </button>
          <Link href={`/products/${product.slug}`} className="btn-card-ghost">
            查看詳情 →
          </Link>
          {(product.sales_count || 0) >= 5 && (
            <p className="t-meta text-center font-semibold text-orange-700">
              🔥 已有 {product.sales_count} 人購買
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
