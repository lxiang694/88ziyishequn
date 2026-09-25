'use client'

/**
 * 商品橫列 —— 賣場分類頁用。
 *
 * 跟首頁的方格卡（ProductCard）是兩種版面，但價格、庫存、規格數的判斷
 * 都走同一組 lib/productPricing 的函式。那幾個數字算錯就是對客人報錯價，
 * 不能有兩套。
 *
 * 用橫列而不是方格：分類頁的任務是「一路往下捲，找到要的那一個」。
 * 橫列一屏放得下四到五件，而且簡介看得到兩行 —— 方格卡在手機上一行
 * 只有兩件，簡介還得藏起來。
 */

import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { lowestActivePrice, isInStock, buyableVariants } from '@/lib/productPricing'
import type { CardProduct } from './ProductCard'

interface Props {
  product: CardProduct
  onAddToCart: (product: CardProduct) => void
}

export default function ProductRow({ product, onAddToCart }: Props) {
  const minPrice = lowestActivePrice(product)
  const inStock = isInStock(product)
  const isMulti = buyableVariants(product).length > 1

  return (
    <article className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 transition-shadow hover:shadow-md">
      <Link href={`/products/${product.slug}`}
        className="relative block h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 sm:h-28 sm:w-28">
        {product.cover_image_url ? (
          <Image src={product.cover_image_url} alt={product.product_name} fill
            className="object-cover" sizes="112px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-gray-200">💊</div>
        )}
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-gray-900/80 px-2 py-1 text-xs font-bold text-white">已售完</span>
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/products/${product.slug}`} className="min-w-0">
          <h3 className="text-[17px] font-bold leading-snug text-gray-800 line-clamp-2 hover:text-green-700">
            {product.product_name}
          </h3>
        </Link>
        {product.short_intro && (
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500 line-clamp-2">
            {product.short_intro}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            {minPrice !== null ? (
              <>
                {isMulti && <div className="text-xs leading-none text-gray-500">起</div>}
                <div className="t-price">{formatPrice(minPrice)}</div>
              </>
            ) : (
              <div className="text-sm text-gray-400">暫無價格</div>
            )}
            {(product.sales_count || 0) >= 5 && (
              <p className="mt-0.5 text-xs font-semibold text-orange-700">
                🔥 已有 {product.sales_count} 人購買
              </p>
            )}
          </div>

          <button
            onClick={() => onAddToCart(product)}
            disabled={!inStock}
            // 售完時仍然顯示按鈕但停用，位置不會因為有沒有貨而跳動
            aria-label={!inStock ? '已售完' : isMulti ? `選擇 ${product.product_name} 的規格` : `將 ${product.product_name} 加入購物車`}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-700 text-white transition-colors hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-400"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  )
}
