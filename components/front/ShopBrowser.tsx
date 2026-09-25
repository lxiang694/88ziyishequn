'use client'

/**
 * 賣場瀏覽：置頂固定搜尋 ＋ 左側分類欄 ＋ 右側商品列。
 *
 * 版面是常見的購物站分類動線：左邊一條窄欄固定住所有分類，右邊就是
 * 商品，點左邊哪一個右邊就換哪一個。分類永遠在畫面上，不用捲回頂端
 * 才能換 —— 這正是「按分類直接進入商品」該有的感覺。
 *
 * 初始商品由伺服器算好傳進來，第一份 HTML 就有商品內容 —— 分類頁
 * 是要給 Google 收錄的，不能只送一個骨架下去。切分類走 Next 的
 * 路由（每個分類有自己的網址，可以收藏、可以分享），搜尋才打 API。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import VariantPicker from './VariantPicker'
import ProductRow from './ProductRow'
import type { CardProduct } from './ProductCard'

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
  heading: string
  subheading?: string
}

const REVEAL_BATCH = 12

/**
 * 左側分類欄要黏在搜尋列正下方，所以要知道上面兩塊有多高。
 *
 *   固定表頭 h-16 / sm:h-20   →  64 / 80
 *   搜尋列 py-3 ＋ 輸入框 h-12 ＋ 下框線  →  12 + 48 + 12 + 1 = 73
 *   合計 137 / 153
 *
 * 搜尋框的高度寫死成 h-12 就是為了讓這個數字站得住；改動表頭高度或
 * 搜尋列的 padding 時，下面這兩個字串要跟著改。
 *
 * 不能用樣板字串把數字拼進 class —— Tailwind 是掃原始碼字面量產生
 * 樣式的，拼出來的 class 不會被產生，畫面上會完全看不出錯，只是沒黏住。
 */
const RAIL_STICKY = 'top-[137px] sm:top-[153px] h-[calc(100vh-137px)] sm:h-[calc(100vh-153px)]'

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
  const railRef = useRef<HTMLElement>(null)

  // 伺服器換頁送來新的商品時，狀態要跟著換掉
  useEffect(() => {
    setProducts(initialProducts)
    setSearch('')
    setVisibleCount(REVEAL_BATCH * 2)
  }, [initialProducts])

  // 把目前分類捲進可視範圍 —— 分類多的時候，從頁尾點進來的那一個
  // 可能在欄位下方看不到，使用者會以為自己沒選到
  useEffect(() => {
    railRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeSlug])

  const runSearch = useCallback(async (term: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (term) params.set('search', term)
      // 搜尋時不限分類 —— 客人打了關鍵字就是要在全站找，
      // 結果被目前分類篩掉只會讓人以為店裡沒有
      const res = await fetch('/api/products?' + params)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data)
        setVisibleCount(REVEAL_BATCH * 2)
      }
    } finally {
      setLoading(false)
    }
  }, [])

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

  const clearSearch = () => { setSearch(''); setProducts(initialProducts); setVisibleCount(REVEAL_BATCH * 2) }
  const searching = search.trim().length > 0
  const visible = products.slice(0, visibleCount)

  const railItem = (active: boolean) =>
    `block border-l-4 px-2 py-4 text-center text-sm leading-snug transition-colors ${
      active
        ? 'border-green-600 bg-white font-bold text-green-800'
        : 'border-transparent text-gray-600 hover:bg-white/60'}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 置頂固定搜尋 ──────────────────────────────────── */}
      {/* top-16 / sm:top-20 對齊 SiteHeader 的高度 */}
      <div className="sticky top-16 z-30 border-b border-gray-100 bg-white sm:top-20">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <label className="relative block">
            <span className="sr-only">搜尋商品</span>
            <input
              type="search"
              value={search}
              onChange={e => { if (e.target.value === '') clearSearch(); else setSearch(e.target.value) }}
              placeholder="搜尋商品名稱或成分關鍵字"
              className="h-12 w-full rounded-full border-2 border-gray-200 pl-11 pr-4 text-base focus:border-green-500 focus:outline-none"
            />
            <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </label>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl">
        {/* ── 左側分類欄 ─────────────────────────────────── */}
        <nav ref={railRef} aria-label="商品分類"
          className={`sticky ${RAIL_STICKY} w-[88px] flex-shrink-0 overflow-y-auto bg-gray-100 sm:w-28`}>
          <Link href="/shop" data-active={activeSlug === ''} className={railItem(activeSlug === '')}>
            全部商品
          </Link>
          {categories.map(cat => (
            <Link key={cat.slug} href={`/shop/${cat.slug}`} data-active={activeSlug === cat.slug}
              className={railItem(activeSlug === cat.slug)}>
              {cat.name}
            </Link>
          ))}
        </nav>

        {/* ── 右側商品列 ─────────────────────────────────── */}
        <div className="min-w-0 flex-1 px-3 py-4 sm:px-4">
          <header className="mb-3">
            <h1 className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-gray-800 sm:text-xl">
              {searching ? `搜尋「${search.trim()}」` : heading}
              <span className="text-sm font-normal text-gray-500">
                {loading ? '搜尋中…' : `共 ${products.length} 件`}
              </span>
            </h1>
            {!searching && subheading && (
              <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{subheading}</p>
            )}
            {searching && (
              <button onClick={clearSearch} className="mt-1 text-sm font-semibold text-green-700 underline">
                清除搜尋，回到{heading}
              </button>
            )}
          </header>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-gray-600">
                {searching ? `找不到「${search.trim()}」相關的商品` : '這個分類還沒有上架商品'}
              </p>
              {searching ? (
                <button onClick={clearSearch} className="mt-3 font-semibold text-green-700 underline">
                  清除搜尋
                </button>
              ) : (
                <Link href="/shop" className="mt-3 inline-block font-semibold text-green-700 underline">
                  看全部商品
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visible.map(p => (
                  <ProductRow key={p.id} product={p} onAddToCart={handleAddToCart} />
                ))}
              </div>
              <div ref={sentinelRef} aria-hidden className="h-px" />
              {visibleCount < products.length && (
                <p className="mt-5 text-center text-sm text-gray-500">往下捲看更多…</p>
              )}
            </>
          )}
        </div>
      </div>

      {pickerProduct && (
        // VariantPicker 要的欄位叫 product_slug，商品資料裡是 slug。
        // 不轉的話加進購物車的品項會缺 slug，購物車那一列就連到
        // /products/undefined。
        <VariantPicker
          product={{ ...pickerProduct, product_slug: pickerProduct.slug } as any}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </div>
  )
}
