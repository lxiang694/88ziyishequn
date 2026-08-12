'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from './CartContext'
import VariantPicker from './VariantPicker'
import { formatPrice } from '@/lib/utils'
import { HOME_SECTIONS, productSection } from '@/lib/homeSections'
import type { HealthCategory } from '@/lib/types'

interface Variant {
  id: number; variant_name: string; sale_price: number
  original_price: number | null; stock_qty: number; sku_code: string | null; is_active: boolean
}
interface Product {
  id: number; product_name: string; slug: string; short_intro: string | null
  cover_image_url: string | null; product_variants: Variant[]
  product_category_relations: { health_categories: HealthCategory }[]
  sales_count?: number; home_section?: string | null
}

interface Props {
  initialProducts: Product[]
  initialTotal: number
  categories: HealthCategory[]
}

const CATEGORY_ICONS: Record<string, string> = {
  'bone-joint': '🦴', 'cardiovascular': '❤️', 'digestive': '🫁',
  'immune': '🛡️', 'beauty-skin': '✨', 'eye-care': '👁️',
  'sleep-relax': '😴', 'weight-management': '⚖️', 'womens-health': '🌸',
  'mens-health': '💪', 'children-growth': '🌱', 'senior-health': '🏆',
}

const HOT_TAGS = ['維生素C', '魚油', '葉黃素', '益生菌', '鈣', '維他命B群']

export default function HomeClient({ initialProducts, initialTotal, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addItem } = useCart()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null)
  const productsRef = useRef<HTMLElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 初始只渲染一屏，往下捲再逐批顯示（先吃已載入資料，用盡再向後端要下一頁）
  const INITIAL_VISIBLE = 12
  const REVEAL_BATCH = 8
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  const scrollToProducts = () => {
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const fetchProducts = useCallback(async (p: number, s: string, cat: string, append = false) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '200' })
    if (s) params.set('search', s)
    if (cat) params.set('category', cat)
    const res = await fetch('/api/products?' + params)
    const data = await res.json()
    if (data.success) {
      setProducts(prev => append ? [...prev, ...data.data] : data.data)
      setTotal(data.total)
    }
    setLoading(false)
  }, [])

  const handleSearch = (val: string) => {
    setSearch(val)
    setSelectedCat('')  // 搜索時自動清除分類，確保全品項搜尋
    setPage(1)
    fetchProducts(1, val, '')
  }

  const handleCat = (slug: string) => {
    const next = selectedCat === slug ? '' : slug
    setSelectedCat(next)
    setSearch('')       // 切換分類時清除搜索詞
    setPage(1)
    fetchProducts(1, '', next)
    setTimeout(scrollToProducts, 100) // 稍等資料載入後滾動
  }

  const loadMore = () => {
    const next = page + 1; setPage(next)
    fetchProducts(next, search, selectedCat, true)
  }

  const isDefaultView = !search && !selectedCat
  // 搜尋 / 分類篩選時用單一網格；預設瀏覽時依「首頁分區」分組（前 N 件預覽 + 查看全部）
  const mainProducts = isDefaultView ? [] : products
  const SECTION_PREVIEW = 8
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  // 依 HOME_SECTIONS 順序分組，只保留有商品的分區
  const sectionGroups = isDefaultView
    ? HOME_SECTIONS.map(sec => ({ sec, items: products.filter(p => productSection(p) === sec.key) }))
        .filter(g => g.items.length > 0)
    : []

  // 分類導覽目前高亮的區塊 id
  const [activeSection, setActiveSection] = useState('')

  const scrollToId = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 換搜尋 / 分類時，重置可見數量回一屏
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE) }, [search, selectedCat])

  // 無限捲動：底部哨兵進入視窗時，先顯示更多已載入商品，用盡再抓下一頁
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      if (visibleCount < mainProducts.length) {
        setVisibleCount(v => Math.min(v + REVEAL_BATCH, mainProducts.length))
      } else if (products.length < total && !loading) {
        loadMore()
      }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount, mainProducts.length, products.length, total, loading])

  // 由底部導覽列「分類」深連結（/?cat=slug）進入時，自動篩選並捲到商品區
  useEffect(() => {
    const cat = searchParams.get('cat') || ''
    if (cat && cat !== selectedCat) {
      setSelectedCat(cat)
      setSearch('')
      setPage(1)
      fetchProducts(1, '', cat)
      setTimeout(scrollToProducts, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleAddToCart = (product: Product) => {
    const active = product.product_variants.filter(v => v.is_active && v.stock_qty > 0)
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

  const handleBuyNow = (product: Product) => {
    const active = product.product_variants.filter(v => v.is_active && v.stock_qty > 0)
    if (active.length === 0) return
    if (active.length === 1) {
      addItem({
        product_id: product.id, product_name: product.product_name,
        product_slug: product.slug, cover_image_url: product.cover_image_url,
        variant_id: active[0].id, variant_name: active[0].variant_name,
        sku_code: active[0].sku_code, unit_price: active[0].sale_price,
        quantity: 1, stock_qty: active[0].stock_qty,
      })
      router.push('/checkout')
    } else {
      setPickerProduct(product)
    }
  }

  const getMinPrice = (variants: Variant[]) => {
    const a = variants.filter(v => v.is_active)
    return a.length ? Math.min(...a.map(v => v.sale_price)) : null
  }
  const getMaxPrice = (variants: Variant[]) => {
    const a = variants.filter(v => v.is_active)
    return a.length ? Math.max(...a.map(v => v.sale_price)) : null
  }
  const hasStock = (variants: Variant[]) => variants.some(v => v.is_active && v.stock_qty > 0)
  const multiVariant = (variants: Variant[]) => variants.filter(v => v.is_active && v.stock_qty > 0).length > 1

  const hotProducts = products.slice(0, 8)

  // 分類導覽：捲動到哪一區，該分類就高亮（scroll spy），讓導覽列一眼看出目前位置
  useEffect(() => {
    if (!isDefaultView) { setActiveSection(''); return }
    const ids = [
      ...(hotProducts.length > 0 ? ['sec-hot'] : []),
      ...sectionGroups.map(g => 'sec-' + g.sec.key),
    ]
    const els = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (els.length === 0) return
    const io = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting)
      if (visible.length === 0) return
      // 取最靠近吸頂列下方的那一區當作「目前所在」
      const topMost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b))
      setActiveSection(topMost.target.id)
    }, { rootMargin: '-210px 0px -65% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefaultView, sectionGroups.length, hotProducts.length, products.length])

  // 商品卡（供「小莊優選」「88自醫社群團購商品」共用）
  const renderProductCard = (product: Product) => {
    const minPrice = getMinPrice(product.product_variants)
    const maxPrice = getMaxPrice(product.product_variants)
    const inStock = hasStock(product.product_variants)
    const isMulti = multiVariant(product.product_variants)
    const cats = product.product_category_relations?.map(r => r.health_categories).filter(Boolean) || []
    return (
      <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200 flex flex-col">
        <Link href={`/products/${product.slug}`} className="block relative">
          <div className="aspect-square bg-gray-50 relative overflow-hidden">
            {product.cover_image_url ? (
              <Image src={product.cover_image_url} alt={product.product_name} fill
                className="object-cover hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">💊</div>
            )}
            {!inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="bg-gray-900/80 text-white text-sm font-bold px-4 py-1.5 rounded-full">已售完</span>
              </div>
            )}
          </div>
        </Link>
        <div className="p-3 sm:p-4 flex flex-col flex-1">
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {cats.slice(0, 1).map((cat: any) => (
                <span key={cat.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold border border-green-100">
                  {CATEGORY_ICONS[cat.slug] || ''} {cat.name}
                </span>
              ))}
            </div>
          )}
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug mb-1 hover:text-green-700 line-clamp-2">{product.product_name}</h3>
          </Link>
          {product.short_intro && (
            <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mb-2 line-clamp-2 hidden sm:block">{product.short_intro}</p>
          )}
          <div className="mt-auto space-y-2 pt-2">
            {(product.sales_count || 0) >= 5 && (
              <p className="text-xs font-bold text-orange-600 leading-none">
                🔥 {(product.sales_count || 0) >= 100 ? `熱銷 ${product.sales_count} 件` : `已售 ${product.sales_count} 件`}
              </p>
            )}
            {minPrice !== null ? (
              <div>
                <div className="text-green-700 font-extrabold text-base sm:text-lg leading-tight">
                  {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} 起`}
                </div>
                {maxPrice !== null && minPrice !== maxPrice && (
                  <div className="text-gray-400 text-xs">最高 {formatPrice(maxPrice)}</div>
                )}
              </div>
            ) : null}
            <button onClick={() => handleAddToCart(product)} disabled={!inStock}
              className={`w-full font-bold py-3 rounded-xl text-sm sm:text-base transition-colors
                ${inStock ? 'bg-green-700 hover:bg-green-800 active:bg-green-900 text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              {!inStock ? '已售完' : isMulti ? '選擇規格' : '加入購物車'}
            </button>
            <Link href={`/products/${product.slug}`}
              className="block w-full text-center border-2 border-gray-200 hover:border-green-400 text-gray-600 hover:text-green-700 font-semibold py-2 rounded-xl text-xs sm:text-sm transition-colors">
              查看詳情 →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ─── HERO ─── */}
      <section className="relative text-white overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(14,63,35,0.93) 0%, rgba(21,95,47,0.88) 50%, rgba(6,78,59,0.90) 100%), url("https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=1400&q=80") center/cover no-repeat' }}>
        <div className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold mb-5 border border-white/30">
              <span className="w-2.5 h-2.5 bg-green-300 rounded-full animate-pulse" />
              88自醫社群團購賣場
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
              守護您與家人的<br className="sm:hidden" />健康日常
            </h1>
            <p className="text-green-100 text-base sm:text-lg leading-relaxed mb-5">
              精選保健品，依健康方向分類，選購更清楚、更安心
            </p>

            {/* 健康自測 CTA — 給「不知道怎麼選」的訪客最直接的入口 */}
            <a href="/health-quiz"
              className="group inline-flex items-center gap-3 bg-white text-green-800 rounded-2xl pl-4 pr-5 py-3 mb-7 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
              <span className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-2xl">🩺</span>
              <span className="text-left leading-tight">
                <span className="block font-bold text-base sm:text-lg">不知道怎麼選？做個健康自測</span>
                <span className="block text-xs sm:text-sm text-green-600 font-semibold mt-0.5">2 分鐘・幫你推薦適合的保健品</span>
              </span>
              <span className="flex-shrink-0 text-green-700 font-bold text-lg group-hover:translate-x-0.5 transition-transform">→</span>
            </a>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-6">
              {[
                { icon: '🏪', title: '7-11 取貨', desc: '全台門市' },
                { icon: '🛒', title: '免註冊下單', desc: '輸入資料即可' },
                { icon: '💬', title: 'LINE 客服', desc: '即時協助' },
              ].map(b => (
                <div key={b.title} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{b.icon}</div>
                  <div className="font-bold text-sm leading-tight">{b.title}</div>
                  <div className="text-green-200 text-xs mt-0.5">{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4">

        {/* ─── STICKY SEARCH ─── */}
        <div className="sticky top-16 sm:top-20 z-30 -mx-4 px-4 pt-3 bg-gray-50/95 backdrop-blur">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-green-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="搜尋商品：維生素C、魚油、葉黃素..."
              className="w-full pl-12 pr-11 py-3.5 text-base sm:text-lg border-2 border-green-200 focus:border-green-500 focus:outline-none rounded-2xl transition-colors bg-white shadow-sm"
            />
            {search && (
              <button onClick={() => handleSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            )}
          </div>
          {/* 熱門關鍵字（次要）：小字淺色，讓下方分類導覽成為視覺重點 */}
          <div className="flex items-center gap-1.5 mt-2 pb-2.5 overflow-x-auto no-scrollbar">
            <span className="text-xs text-gray-400 flex-shrink-0">熱門</span>
            {HOT_TAGS.map(t => (
              <button key={t} onClick={() => handleSearch(t)}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors ${search === t ? 'bg-green-700 text-white font-semibold' : 'bg-white/80 text-gray-500 border border-gray-200 hover:text-green-700 hover:border-green-300'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* ─── 分類導覽列（主要）：獨立白色導覽帶，捲動時高亮目前分區 ─── */}
          {isDefaultView && sectionGroups.length > 0 ? (
            <div className="-mx-4 px-4 py-2.5 bg-white border-t border-gray-100 border-b-2 border-b-green-600 shadow-sm">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {hotProducts.length > 0 && (
                  <button onClick={() => scrollToId('sec-hot')}
                    className={`flex-shrink-0 text-sm font-bold px-4 py-2 rounded-full border-2 transition-all ${
                      activeSection === 'sec-hot'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md scale-105'
                        : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}>
                    🔥 本週熱銷
                  </button>
                )}
                {sectionGroups.map(({ sec, items }) => {
                  const active = activeSection === 'sec-' + sec.key
                  return (
                    <button key={sec.key} onClick={() => scrollToId('sec-' + sec.key)}
                      className={`flex-shrink-0 text-sm font-bold px-4 py-2 rounded-full border-2 transition-all ${
                        active
                          ? 'bg-green-700 text-white border-green-700 shadow-md scale-105'
                          : 'bg-white text-green-800 border-green-300 hover:bg-green-50'}`}>
                      {sec.emoji} {sec.label}
                      <span className={`ml-1 text-xs font-semibold ${active ? 'text-green-100' : 'text-green-500'}`}>{items.length}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="-mx-4 border-b border-gray-100" />
          )}
        </div>

        {/* ─── CATEGORY GRID ─── */}
        {!search && categories.length > 0 && (
          <section className="py-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">依健康方向選購</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCat(cat.slug)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all
                    ${selectedCat === cat.slug
                      ? 'border-green-600 bg-green-50 shadow-md scale-[1.03]'
                      : 'border-gray-100 bg-white hover:border-green-300 hover:shadow-sm'}`}
                >
                  <span className="text-2xl">{CATEGORY_ICONS[cat.slug] || '💊'}</span>
                  <span className={`text-xs font-semibold leading-tight text-center
                    ${selectedCat === cat.slug ? 'text-green-800' : 'text-gray-700'}`}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!search && !selectedCat && (
        <>
        {/* ─── 本週熱銷 RAIL ─── */}
        {hotProducts.length > 0 && (
          <section id="sec-hot" className="pt-6 pb-2 scroll-mt-56">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-800">🔥 本週熱銷</h2>
              <button onClick={scrollToProducts} className="text-green-700 text-sm font-bold hover:underline">看全部 →</button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
              {hotProducts.map((product, idx) => {
                const minPrice = getMinPrice(product.product_variants)
                const inStock = hasStock(product.product_variants)
                const isMulti = multiVariant(product.product_variants)
                return (
                  <div key={product.id} className="flex-shrink-0 w-36 sm:w-40 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <Link href={`/products/${product.slug}`} className="block relative">
                      <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        {product.cover_image_url
                          ? <Image src={product.cover_image_url} alt={product.product_name} fill className="object-cover" sizes="160px" />
                          : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-200">💊</div>}
                        {idx < 3 && <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">熱銷 {idx + 1}</span>}
                        {!inStock && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="bg-gray-900/80 text-white text-xs font-bold px-3 py-1 rounded-full">已售完</span></div>}
                      </div>
                    </Link>
                    <div className="p-2.5 flex flex-col flex-1">
                      <Link href={`/products/${product.slug}`}>
                        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-green-700">{product.product_name}</h3>
                      </Link>
                      <div className="mt-auto pt-2">
                        {minPrice !== null && <div className="text-green-700 font-extrabold text-base leading-tight mb-1.5">{formatPrice(minPrice)}{multiVariant(product.product_variants) ? ' 起' : ''}</div>}
                        <button onClick={() => handleAddToCart(product)} disabled={!inStock}
                          className={`w-full font-bold py-2 rounded-xl text-xs transition-colors ${inStock ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                          {!inStock ? '已售完' : isMulti ? '選規格' : '加入購物車'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ─── QUIZ + ARTICLES + SLEEP ENTRY ─── */}
        <section className="py-2 mb-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <a href="/health-quiz" className="block">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-700 to-emerald-600 p-5 shadow-md hover:shadow-lg transition-shadow h-full">
              <div className="flex items-center justify-between gap-3 h-full">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-snug mb-1">
                    🩺 健康自測
                  </p>
                  <p className="text-green-100 text-sm leading-relaxed">
                    2 分鐘了解您的保健需求
                  </p>
                </div>
                <div className="flex-shrink-0 bg-white/20 text-white font-bold text-sm px-3 py-2 rounded-xl">
                  →
                </div>
              </div>
            </div>
          </a>
          <a href="/sleep-quiz" className="block">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-5 shadow-md hover:shadow-lg transition-shadow h-full">
              <div className="flex items-center justify-between gap-3 h-full">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-snug mb-1">
                    🌙 睡眠自測
                  </p>
                  <p className="text-indigo-100 text-sm leading-relaxed">
                    國際 ISI 量表 · 失眠分級
                  </p>
                </div>
                <div className="flex-shrink-0 bg-white/20 text-white font-bold text-sm px-3 py-2 rounded-xl">
                  →
                </div>
              </div>
            </div>
          </a>
          <a href="/health-articles" className="block">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-5 shadow-md hover:shadow-lg transition-shadow h-full">
              <div className="flex items-center justify-between gap-3 h-full">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-snug mb-1">
                    📚 健康知識
                  </p>
                  <p className="text-amber-50 text-sm leading-relaxed">
                    40+ 中年保養經驗分享
                  </p>
                </div>
                <div className="flex-shrink-0 bg-white/20 text-white font-bold text-sm px-3 py-2 rounded-xl">
                  →
                </div>
              </div>
            </div>
          </a>
        </section>

        {/* ─── OFFLINE EVENT ENTRY ─── */}
        <section className="py-2 mb-2">
          <Link href="/events" className="block group">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 p-5 sm:p-6 shadow-md hover:shadow-xl transition-all">
              <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
              <div className="absolute -right-10 bottom-0 w-20 h-20 bg-white/10 rounded-full" />
              <div className="relative flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl sm:text-4xl">
                  🎉
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-1.5 bg-white/25 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs font-bold text-white mb-1.5">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    線下活動・開放報名
                  </div>
                  <p className="text-white font-bold text-base sm:text-xl leading-snug">
                    🎉 88自醫社群・線下健康見面會
                  </p>
                  <p className="text-white/90 text-xs sm:text-sm mt-0.5 leading-relaxed">
                    多場次・不同地點陸續開放，查看場次報名 →
                  </p>
                </div>
                <div className="flex-shrink-0 hidden sm:flex bg-white text-rose-600 font-bold text-sm px-4 py-2.5 rounded-xl group-hover:scale-105 transition-transform">
                  查看場次
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="py-6 mb-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-700 mb-4 text-center">📋 四步驟完成購物</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { step: '1', icon: '🛍️', text: '選商品' },
                { step: '2', icon: '📦', text: '選規格' },
                { step: '3', icon: '✍️', text: '填資料' },
                { step: '4', icon: '🏪', text: '選 7-11 門市完成下單' },
              ].map(s => (
                <div key={s.step} className="flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">{s.icon}</div>
                  <div className="text-sm font-medium text-gray-600 leading-tight">{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 各賣場分區預覽（每類前 N 件 + 查看全部），平衡各分類曝光 ─── */}
        {sectionGroups.map(({ sec, items }) => {
          const expanded = !!expandedSections[sec.key]
          const shown = expanded ? items : items.slice(0, SECTION_PREVIEW)
          return (
            <section key={sec.key} id={'sec-' + sec.key} className="pt-8 pb-2 scroll-mt-56">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{sec.emoji} {sec.label}</h2>
                <span className="text-gray-500 text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">共 {items.length} 件</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {shown.map(renderProductCard)}
              </div>
              {items.length > SECTION_PREVIEW && (
                <div className="text-center mt-5">
                  <button onClick={() => setExpandedSections(s => ({ ...s, [sec.key]: !expanded }))}
                    className="inline-flex items-center gap-1.5 border-2 border-green-600 text-green-700 font-bold px-6 py-2.5 rounded-xl hover:bg-green-50 transition-colors">
                    {expanded ? '收合' : `查看全部 ${items.length} 件`}
                    <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
            </section>
          )
        })}
        </>
        )}

        {/* ─── PRODUCTS（搜尋 / 分類篩選結果）─── */}
        {!isDefaultView && (
        <section ref={productsRef} className="pt-6 pb-12 scroll-mt-32">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              {search ? '搜尋結果' : selectedCat ? categories.find(c => c.slug === selectedCat)?.name : '88自醫社群團購商品'}
            </h2>
            <span className="text-gray-500 text-sm sm:text-base font-medium bg-gray-100 px-3 py-1 rounded-full">
              {loading ? '搜尋中...' : `共 ${isDefaultView ? mainProducts.length : total} 件`}
            </span>
          </div>

          {!loading && mainProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-lg text-gray-500 mb-4">{isDefaultView ? '目前沒有商品' : '找不到相關商品'}</p>
              {!isDefaultView && <button onClick={() => { setSearch(''); setSelectedCat(''); fetchProducts(1, '', '') }} className="btn-secondary py-2 px-6 text-base">清除篩選</button>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {mainProducts.slice(0, visibleCount).map(product => {
                  const minPrice = getMinPrice(product.product_variants)
                  const maxPrice = getMaxPrice(product.product_variants)
                  const inStock = hasStock(product.product_variants)
                  const isMulti = multiVariant(product.product_variants)
                  const cats = product.product_category_relations?.map(r => r.health_categories).filter(Boolean) || []

                  return (
                    <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200 flex flex-col">
                      <Link href={`/products/${product.slug}`} className="block relative">
                        <div className="aspect-square bg-gray-50 relative overflow-hidden">
                          {product.cover_image_url ? (
                            <Image
                              src={product.cover_image_url}
                              alt={product.product_name}
                              fill
                              className="object-cover hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">💊</div>
                          )}
                          {!inStock && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="bg-gray-900/80 text-white text-sm font-bold px-4 py-1.5 rounded-full">已售完</span>
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="p-3 sm:p-4 flex flex-col flex-1">
                        {/* Category tags */}
                        {cats.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {cats.slice(0, 1).map((cat: any) => (
                              <span key={cat.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold border border-green-100">
                                {CATEGORY_ICONS[cat.slug] || ''} {cat.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Product name */}
                        <Link href={`/products/${product.slug}`}>
                          <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug mb-1 hover:text-green-700 line-clamp-2">{product.product_name}</h3>
                        </Link>

                        {/* Short intro */}
                        {product.short_intro && (
                          <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mb-2 line-clamp-2 hidden sm:block">{product.short_intro}</p>
                        )}

                        <div className="mt-auto space-y-2 pt-2">
                          {/* Sales count — 銷量 ≥ 5 才顯示 */}
                          {(product.sales_count || 0) >= 5 && (
                            <p className="text-xs font-bold text-orange-600 leading-none">
                              🔥 {(product.sales_count || 0) >= 100 ? `熱銷 ${product.sales_count} 件` : `已售 ${product.sales_count} 件`}
                            </p>
                          )}

                          {/* Price — 大字清晰顯示 */}
                          {minPrice !== null ? (
                            <div>
                              <div className="text-green-700 font-extrabold text-base sm:text-lg leading-tight">
                                {minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} 起`}
                              </div>
                              {maxPrice !== null && minPrice !== maxPrice && (
                                <div className="text-gray-400 text-xs">最高 {formatPrice(maxPrice)}</div>
                              )}
                            </div>
                          ) : null}

                          {/* 加入購物車主按鈕 — 大且醒目 */}
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={!inStock}
                            className={`w-full font-bold py-3 rounded-xl text-sm sm:text-base transition-colors
                              ${inStock
                                ? 'bg-green-700 hover:bg-green-800 active:bg-green-900 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                          >
                            {!inStock ? '已售完' : isMulti ? '選擇規格' : '加入購物車'}
                          </button>

                          {/* 查看詳情次要按鈕 */}
                          <Link href={`/products/${product.slug}`}
                            className="block w-full text-center border-2 border-gray-200 hover:border-green-400 text-gray-600 hover:text-green-700 font-semibold py-2 rounded-xl text-xs sm:text-sm transition-colors">
                            查看詳情 →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Loading skeleton */}
                {loading && products.length === 0 && [...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              {/* 無限捲動哨兵 + 載入指示 */}
              {(visibleCount < mainProducts.length || products.length < total) && (
                <div ref={sentinelRef} className="flex justify-center items-center gap-2 py-8 text-gray-400 text-sm">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  載入更多商品...
                </div>
              )}
            </>
          )}
        </section>
        )}
      </div>

      {/* Variant Picker Modal/Drawer */}
      {pickerProduct && (
        <VariantPicker
          product={pickerProduct}
          onClose={() => setPickerProduct(null)}
        />
      )}
    </div>
  )
}
