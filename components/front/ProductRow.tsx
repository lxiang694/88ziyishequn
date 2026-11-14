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
import { strikePrice } from '@/lib/shopSort'

interface Props {
  product: CardProduct
  onAddToCart: (product: CardProduct) => void
  /** 新品上市頁：標出上架日期 */
  showListedDate?: boolean
}

/** 台灣日期 M/D */
function listedDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000)
  return Number.isFinite(d.getTime()) ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : ''
}

export default function ProductRow({ product, onAddToCart, showListedDate }: Props) {
  const minPrice = lowestActivePrice(product)
  const inStock = isInStock(product)
  const buyable = buyableVariants(product)
  const isMulti = buyable.length > 1
  // 規格都同價就不寫「起」
  const priceVaries = new Set(buyable.map((v: any) => v.sale_price)).size > 1
  const strike = strikePrice(product)

  return (
    <article className="rounded-2xl border border-line bg-white p-3 transition-shadow hover:shadow-md">
      <div className="flex gap-3 big:flex-col">
        <Link href={`/products/${product.slug}`}
          className="relative block h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-paper sm:h-24 sm:w-24 big:h-36 big:w-full">
          {product.cover_image_url ? (
            <Image src={product.cover_image_url} alt={product.product_name} fill
              className="object-cover big:object-contain" sizes="(max-width: 640px) 50vw, 96px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-gray-200">💊</div>
          )}
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="rounded-full bg-gray-900/80 px-2 py-1 text-xs font-bold text-white">已售完</span>
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          {showListedDate && listedDate(product.created_at) && (
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">NEW</span>
              {listedDate(product.created_at)} 上架
            </p>
          )}
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
        </div>
      </div>

      {/*
        價格＋按鈕放在卡片最下面一整列（左價格、右按鈕）。
        以前放在右邊文字欄裡：價格一行、已售＋按鈕再一行，卡片下半部很空；
        文字欄只有約 170px，價格和按鈕也擠不進同一行。整張卡的寬度就放得下，每張卡矮約 30px。
        台灣購物網站的習慣：「NT$360 起」（起放後面）、有原價就劃線、銷量寫「已售 151」。
        按鈕用文字（＋購物車／選規格），中高齡客人一看就知道能按。
        大字體時放不下就自動換行，按鈕不會被擠掉。
      */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-gray-100 pt-2.5">
        <div className="min-w-0">
          {minPrice !== null ? (
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="t-price">{formatPrice(minPrice)}</span>
              {priceVaries && <span className="text-[13px] text-gray-500">起</span>}
              {strike !== null && <s className="text-[13px] text-gray-400">{formatPrice(strike)}</s>}
            </p>
          ) : (
            <p className="text-sm text-gray-400">暫無價格</p>
          )}
          {(product.sales_count || 0) >= 5 && (
            <p className="text-[13px] font-semibold leading-tight text-orange-700">已售 {product.sales_count}</p>
          )}
        </div>
        <button
          onClick={() => onAddToCart(product)}
          disabled={!inStock}
          aria-label={!inStock ? '已售完' : isMulti ? `選擇 ${product.product_name} 的規格` : `將 ${product.product_name} 加入購物車`}
          className="min-h-[40px] flex-shrink-0 rounded-xl bg-green-700 px-3.5 text-[14px] font-bold text-white transition-colors hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-500 big:w-full"
        >
          {!inStock ? '已售完' : isMulti ? '選規格' : '＋購物車'}
        </button>
      </div>
    </article>
  )
}
