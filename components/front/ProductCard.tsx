'use client'

/**
 * 商品卡 —— 首頁的方格版面。
 *
 * 高度是這張卡最重要的設計約束。改版前一張卡約 480px，在手機上一屏
 * 只看得到一列多一點，要找東西得一直捲。現在約 330px，省下來的是：
 *
 *   • 「查看詳情」那顆全寬按鈕（約 52px）—— 圖片與標題本來就是連到
 *     商品頁的連結，再放一顆按鈕做同一件事，只是把每張卡撐高一截
 *   • 「共 N 種規格」與「已有 N 人購買」併成一行（約 38px）
 *   • 標題從最多三行收成兩行（約 36px），字級維持 17px 不縮，
 *     只把行高從 1.625 改成 leading-snug
 *   • 分類標籤整條拿掉（約 26px）
 *
 * 分類標籤（免疫力提升、體重管理…）是刻意移除的，不是漏掉：那是
 * 健康訴求分類，給文章推薦與自測結果用的，客人在賣場逛的時候看的是
 * 商品分類，兩套標籤混在同一張卡上只會讓人更難掃。
 *
 * 價格、庫存、規格數的判斷跟賣場的橫列（ProductRow）走同一組
 * lib/productPricing 的函式 —— 版面有兩種，那幾個數字只能有一套。
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
}

export default function ProductCard({ product, rank, onAddToCart }: Props) {
  const minPrice = lowestActivePrice(product)
  const inStock = isInStock(product)
  const isMulti = buyableVariants(product).length > 1
  const variantCount = activeVariantCount(product)
  const sales = product.sales_count || 0

  // 規格數與銷量併成一行（原本各佔一行）。兩個都沒有就整行不出現。
  // 銷量放前面：窄螢幕這行會被截斷，先保住比較能推一把的那個資訊。
  const meta = [
    sales >= 5 ? `🔥 ${sales} 人買過` : '',
    variantCount > 1 ? `${variantCount} 種規格` : '',
  ].filter(Boolean).join('・')

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg">
      <Link href={`/products/${product.slug}`} className="relative block">
        <div className="relative aspect-square overflow-hidden bg-paper">
          {product.cover_image_url ? (
            <Image src={product.cover_image_url} alt={product.product_name} fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl text-gray-200">💊</div>
          )}
          {/* 純裝飾角標：熱銷名次 */}
          {rank !== undefined && rank < 3 && (
            <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-0.5 t-badge-deco font-bold text-white">
              熱銷 {rank + 1}
            </span>
          )}
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="rounded-full bg-gray-900/80 px-4 py-2 text-base font-bold text-white">已售完</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link href={`/products/${product.slug}`}>
          {/* leading-snug 覆寫 t-product-title 的 1.625 行高：字級維持 17px
              不縮，但兩行只佔 47px（原本三行 83px） */}
          <h3 className="t-product-title leading-snug line-clamp-2 group-hover:text-green-700">
            {product.product_name}
          </h3>
        </Link>

        {/* 簡介只在桌機顯示。手機本來就藏著，這裡維持原樣，
            不要因為改版把桌機上原有的資訊也拿掉 */}
        {product.short_intro && (
          <p className="mt-1 hidden text-[13px] leading-relaxed text-gray-500 line-clamp-2 sm:block">
            {product.short_intro}
          </p>
        )}

        {/* 價格一行、按鈕一行。
            原本試過把兩者併成同一列（價格左、圓鈕右）來再省 40px，但實際
            量過不行：手機兩欄時卡片只有 166px，扣掉內距與 48px 的按鈕，
            留給價格只剩 86px，連「NT$580 起」都會被截成「NT$5…」。
            報錯價比卡片高一點嚴重得多，所以維持兩行。 */}
        <div className="mt-auto pt-2.5">
          {minPrice !== null ? (
            <div className="t-price whitespace-nowrap">
              {formatPrice(minPrice)}
              {isMulti && <span className="ml-0.5 text-[13px] font-normal text-gray-500">起</span>}
            </div>
          ) : (
            <div className="text-sm text-gray-400">暫無價格</div>
          )}

          <button
            onClick={() => onAddToCart(product)}
            disabled={!inStock}
            className="btn-card mt-2"
          >
            {!inStock ? '已售完' : isMulti ? '選擇規格' : '加入購物車'}
          </button>
        </div>

        {meta && (
          <p className="mt-1.5 truncate text-[12px] leading-tight text-gray-500">{meta}</p>
        )}
      </div>
    </div>
  )
}
