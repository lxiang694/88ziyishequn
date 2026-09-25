'use client'

/**
 * 賣場瀏覽：置頂固定搜尋 ＋ 分類列 ＋ 商品牆。
 *
 * 動線刻意做成「點分類 → 商品就在下面，一路往下捲」，中間不插其他
 * 區塊。首頁有故事、有活動、有分區推薦，那是給第一次來的人看的；
 * 已經知道自己要買什麼的人需要的是一面可以捲的貨架。
 *
 * 初始商品由伺服器算好傳進來，第一份 HTML 就有商品內容 —— 分類頁
 * 是要給 Google 收錄的，不能只送一個骨架下去。切換分類才走 API。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import VariantPicker from './VariantPicker'
import ProductCard, { type CardProduct } from './ProductCard'

export interface ShopCategory {
  id: number
  slug: string
  name: string
  emoji: string
  description?: string
}

interface Props {
  categories: ShopCategory[]
  /** 目前選到的分類 slug；空字串代表「全部商品」 */
  activeSlug: string
  initialProducts: CardProduct[]
  /** 標題與說明，由頁面決定 */
  heading: string
  subheading?: string
}

const REVEAL_BATCH = 12

export default function ShopBrowser({
  categories, activeSlug, initialProducts, heading, subheading,
}: Props) {
  const router = useRouter()
  const { addItem } = useCart()
  const [products, setProducts] = useState<CardProduct[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [pickerProduct, setPickerProduct] = useState<CardProduct | null>(null)
  const [visibleCount, setVisibleCount] = useState(REVEAL_BATCH * 2)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  // 伺服器換頁送來新的商品時，狀態要跟著換掉
  useEffect(() => {
    setProducts(initialProducts)
    setSearch('')
    setVisibleCount(REVEAL_BATCH * 2)
  }, [initialProducts])

  // 把目前分類捲進可視範圍 —— 第九個分類在手機上預設看不到，
  // 使用者從頁尾點進來會以為自己沒選到
  useEffect(() => {
    railRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeSlug])

  const runSearch = useCallback(async (term: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (term) params.set('search', term)
      if (activeSlug) params.set('shop', activeSlug)
      const res = await fetch('/api/products?' + params)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
        setVisibleCount(REVEAL_BATCH * 2)
      }
    } finally {
      setLoading(false)
    }
  }, [activeSlug])

  // 打字停 300ms 才送查詢，不要每個字都打一次 API
  useEffect(() => {
    if (search === '') return
    const timer = setTimeout(() => { runSearch(search) }, 300)
    return () => clearTimeout(timer)
  }, [search, runSearch])

  // 捲到底再多顯示一批（資料已經在手上，不用再打 API）
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(c => (c >= products.length ? c : c + REVEAL_BATCH))
      }
    }, { rootMargin: '400px' })
    io.observe(node)
    return () => io.disconnect()
  }, [products.length])

  const handleAddToCart = (product: CardProduct) => {
    const active = (product.product_variants || []).filter((v: any) => v.is_active && v.stock_qty > 0)
    if (active.length === 0) return
    if (active.length === 1) {
      addItem({
        product_id: product.id, product_name: product.product_name,
        product_slug: product.slug, cover_image_url: product.cover_image_url,
        variant_id: active[0].id, variant_name: active[0].variant_name,
        sku_code: active[0].sku_code, unit_price: active[0].sale_price,
        quantity: 1, stock_qty: active[0].stock_qty,
      })
    } else {
      setPickerProduct(product)
    }
  }

  const visible = products.slice(0, visibleCount)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 置頂固定：搜尋 ＋ 分類列 ───────────────────────── */}
      {/* top-16 / sm:top-20 對齊 SiteHeader 的高度，兩條一起固定 */}
      <div className="sticky top-16 sm:top-20 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <label className="relative block">
            <span className="sr-only">搜尋商品</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋商品名稱…"
              className="w-full rounded-2xl border-2 border-gray-200 py-3 pl-11 pr-4 text-base focus:border-green-500 focus:outline-none"
            />
            <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </label>

          <div ref={railRef} className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/shop" data-active={activeSlug === ''}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                activeSlug === '' ? 'border-green-600 bg-green-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'}`}>
              全部商品
            </Link>
            {categories.map(cat => (
              <Link key={cat.slug} href={`/shop/${cat.slug}`} data-active={activeSlug === cat.slug}
                className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  activeSlug === cat.slug ? 'border-green-600 bg-green-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'}`}>
                {cat.emoji} {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── 商品牆 ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">{heading}</h1>
          {subheading && <p className="mt-1 text-sm leading-relaxed text-gray-600">{subheading}</p>}
          <p className="mt-2 text-sm text-gray-500">
            {loading ? '搜尋中…' : search ? `「${search}」共 ${products.length} 件` : `共 ${products.length} 件`}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">
              {search ? `找不到「${search}」相關的商品` : '這個分類還沒有上架商品'}
            </p>
            {search ? (
              <button onClick={() => { setSearch(''); router.refresh() }}
                className="mt-3 font-semibold text-green-700 underline">清除搜尋</button>
            ) : (
              <Link href="/shop" className="mt-3 inline-block font-semibold text-green-700 underline">
                看全部商品
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {visible.map(p => (
                <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
              ))}
            </div>
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {visibleCount < products.length && (
              <p className="mt-6 text-center text-sm text-gray-500">往下捲看更多…</p>
            )}
          </>
        )}
      </div>

      {pickerProduct && (
        // VariantPicker 要的欄位叫 product_slug，商品資料裡是 slug。
        // 不轉的話加進購物車的品項會缺 slug，購物車那一列就連到
        // /products/undefined（首頁原本就有這個問題，一併修掉了）。
        <VariantPicker
          product={{ ...pickerProduct, product_slug: pickerProduct.slug } as any}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </div>
  )
}
