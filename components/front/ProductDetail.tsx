'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { formatPrice } from '@/lib/utils'
import { timingLabels } from '@/lib/productMeta'
import { renderProductText } from '@/lib/productBlocks'
import ProductGallery from './ProductGallery'
import VariantPicker from './VariantPicker'
import toast from 'react-hot-toast'
import SocialShareButtons from './SocialShareButtons'
import ProductRecommendations from './ProductRecommendations'
import { PRESALE } from '@/lib/presale/camelliaOil'
import { SITE_URL } from '@/lib/siteUrl'
import type { ScoredArticle } from '@/lib/productArticleMatcher'
import type { RecItem } from './ProductRecommendations'
import { EMPTY_SUMMARY } from '@/lib/reviews'
import ProductReviews, { type InitialReviews } from './ProductReviews'
import SectionTabs, { type TabItem } from './SectionTabs'
import Collapsible from './Collapsible'
import { Stars } from './StarRating'

const NO_REVIEWS: InitialReviews = { ready: false, summary: EMPTY_SUMMARY, reviews: [], hasMore: false }


interface Variant {
  id: number
  variant_name: string
  sale_price: number
  original_price: number | null
  stock_qty: number
  sku_code: string | null
  sort_order: number
  is_active: boolean
}

interface ProductImage {
  id: number
  image_url: string
  sort_order: number
}

interface Product {
  id: number
  product_name: string
  slug: string
  short_intro: string | null
  suitable_people: string | null
  usage_method: string | null
  ingredients: string | null
  precautions: string | null
  storage_method: string | null
  intake_timing: string | null
  pairing_tips: string | null
  source_notes: string | null
  cover_image_url: string | null
  product_variants: Variant[]
  product_images: ProductImage[]
  product_category_relations: { health_categories: { id: number; name: string; slug: string } }[]
  sales_count?: number
}

export default function ProductDetail({ product, relatedArticles = [], recommended = [], initialReviews = NO_REVIEWS }: {
  product: Product
  /** 由伺服器算好傳進來；沒有夠相關的文章時為空陣列 */
  relatedArticles?: ScoredArticle[]
  /** 「你可能也會喜歡」的 6 件商品，由伺服器算好 */
  recommended?: RecItem[]
  /** 評價摘要與第一頁，由伺服器查好；沒有時當成還沒有評價 */
  initialReviews?: InitialReviews
}) {
  const router = useRouter()
  const { addItem, totalItems } = useCart()
  const [reviewFormOpen, setReviewFormOpen] = useState(false)
  const reviewCount = initialReviews.summary.count

  const hasIntro = !!(product.suitable_people || timingLabels(product.intake_timing).length > 0 || product.usage_method || product.pairing_tips || product.source_notes)
  const hasSpec = !!(product.ingredients || product.precautions || product.storage_method)
  const tabs: TabItem[] = [
    ...(hasIntro ? [{ id: 'intro', label: '商品介紹' }] : []),
    ...(hasSpec ? [{ id: 'spec', label: '成分規格' }] : []),
    { id: 'reviews', label: '評價', badge: reviewCount ? `(${reviewCount})` : undefined },
  ]
  const goReviews = () => {
    const node = document.getElementById('reviews')
    if (node) window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 124, behavior: 'smooth' })
  }

  // 從登入頁回來（網址帶 #write-review）：直接捲到評價區並打開寫評價
  useEffect(() => {
    if (window.location.hash !== '#write-review') return
    history.replaceState(null, '', window.location.pathname)
    setTimeout(() => { goReviews(); setReviewFormOpen(true) }, 300)
  }, [])

  // 有兩種以上規格時不先幫客人選：以前預設第一個，客人往下看完介紹直接按底部的「立即購買」，
  // 常常買到不是自己要的規格。沒選就按購買 → 跳出規格面板，一定要點選過才會加入。
  const activeVariants = product.product_variants?.filter(v => v.is_active) || []
  const multiVariant = activeVariants.length > 1
  const firstAvailable = product.product_variants?.find(v => v.is_active && v.stock_qty > 0)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    multiVariant ? null : (firstAvailable || product.product_variants?.[0] || null)
  )
  const [qty, setQty] = useState(1)
  // 規格面板：cart＝選好後加入購物車、buy＝選好後去結帳、choose＝只是選／換規格
  const [sheet, setSheet] = useState<null | 'cart' | 'buy' | 'choose'>(null)
  const prices = activeVariants.map(v => v.sale_price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const priceRange = minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)}～${formatPrice(maxPrice)}`
  const anyInStock = activeVariants.some(v => v.stock_qty > 0)

  const allImages = [
    ...(product.cover_image_url ? [product.cover_image_url] : []),
    ...(product.product_images?.map(i => i.image_url) || []),
  ]
  const cats = product.product_category_relations?.map(r => r.health_categories).filter(Boolean) || []
  const inStock = (selectedVariant?.stock_qty ?? 0) > 0
  // 還沒選規格時，只要有任何一種有貨，按鈕就能按（按了會先跳出規格面板）
  const canBuy = selectedVariant ? inStock : anyInStock

  const addVariant = (v: Variant, n: number) => addItem({
    product_id: product.id, product_name: product.product_name,
    product_slug: product.slug, cover_image_url: product.cover_image_url,
    variant_id: v.id, variant_name: v.variant_name,
    sku_code: v.sku_code, unit_price: v.sale_price,
    quantity: n, stock_qty: v.stock_qty,
  })

  const handleAddToCart = () => {
    if (!selectedVariant) { if (multiVariant) setSheet('cart'); else toast.error('請選擇規格'); return }
    if (!inStock) { toast.error('此規格已售完'); return }
    addVariant(selectedVariant, qty)
  }

  const handleBuyNow = () => {
    if (!selectedVariant) { if (multiVariant) setSheet('buy'); return }
    if (!inStock) return
    addVariant(selectedVariant, qty)
    router.push('/checkout')
  }

  // 規格面板選好後：記住選的規格（頁面上也跟著變），再依按的是哪個按鈕去做
  const confirmSheet = (picked: { id: number }, n: number) => {
    const v = product.product_variants.find(x => x.id === picked.id)
    if (!v) return
    setSelectedVariant(v); setQty(n)
    if (sheet === 'cart') addVariant(v, n)
    if (sheet === 'buy') { addVariant(v, n); router.push('/checkout') }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4 pb-0 md:py-6">
      {/* Breadcrumb —— 手機上表頭已有「‹」返回鍵、點 Logo 回首頁，不再多佔一行 */}
      <nav className="hidden md:flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href="/" className="hover:text-green-700 transition-colors">首頁</Link>
        <span>›</span>
        <span className="text-gray-700 line-clamp-1">{product.product_name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 mb-10">
        {/* Images —— 正方形。商品圖幾乎都是正方形的宣傳圖，容器改成 4:3 時左右會多出
            兩條白邊，看起來很空。購買按鈕已經固定在畫面底部，不必再壓縮圖片高度。
            object-contain：少數非正方形的圖完整顯示，不裁掉圖上的文字。 */}
        <ProductGallery images={allImages} alt={product.product_name} />

        {/* Product info —— 先給買東西需要的：名稱、價格、規格、數量、按鈕；
            介紹與分類標籤放在按鈕後面 */}
        <div className="flex flex-col">
          <h1 className="text-[22px] sm:text-3xl font-bold text-gray-900 mb-2 leading-snug">{product.product_name}</h1>

          {/* 評分一行（台灣購物網站的習慣：名稱下方就看得到幾顆星、幾則評價），點了跳到評價區 */}
          <button type="button" onClick={goReviews}
            className="mb-3 flex w-fit items-center gap-2 text-[14px] text-gray-600 hover:text-green-700">
            {reviewCount > 0 ? (
              <>
                <span className="font-bold text-amber-600 tabular-nums">{initialReviews.summary.average.toFixed(1)}</span>
                <Stars value={initialReviews.summary.average} size={15} />
                <span className="underline underline-offset-2">{reviewCount} 則評價</span>
              </>
            ) : (
              <>
                <Stars value={0} size={15} />
                <span className="underline underline-offset-2">尚無評價，寫第一則</span>
              </>
            )}
          </button>

          {/*
            預售商品的出貨時間跟一般商品不同。從首頁或搜尋進到這一頁的人
            看不到預售頁的說明，如果不講清楚，他們會以為是立即出貨。
          */}
          {product.slug === PRESALE.productSlug && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-4">
              <p className="font-bold text-amber-900 mb-1">🌿 這是預售商品</p>
              <p className="text-amber-800 text-[15px] leading-relaxed mb-2">
                油還在山上，現在下訂是預約今年這一批，預計 {PRESALE.shipMonth} 出貨。
              </p>
              <Link href="/camellia-oil"
                className="inline-flex items-center gap-1 font-bold text-amber-900 underline min-h-[44px]">
                看完整介紹與出貨時程 →
              </Link>
            </div>
          )}

          {!selectedVariant && multiVariant && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
              <span className="text-3xl font-bold text-green-700">{priceRange}</span>
              <span className="text-sm text-gray-500">依規格不同</span>
            </div>
          )}
          {selectedVariant && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
              <span className="text-3xl font-bold text-green-700">{formatPrice(selectedVariant.sale_price)}</span>
              {selectedVariant.original_price && selectedVariant.original_price > selectedVariant.sale_price && (
                <>
                  <span className="text-gray-600 line-through text-lg">{formatPrice(selectedVariant.original_price)}</span>
                  <span className="bg-red-50 text-red-600 text-sm font-bold px-2 py-0.5 rounded-lg">
                    省 {formatPrice(selectedVariant.original_price - selectedVariant.sale_price)}
                  </span>
                </>
              )}
              {/* 已售數量 —— 社會證明，滿 5 件才顯示，跟價格放同一行省一整列 */}
              {(product.sales_count || 0) >= 5 && (
                <span className="text-sm font-bold text-orange-700">
                  🔥 {(product.sales_count || 0) >= 100 ? '熱銷・' : ''}已售 {product.sales_count} 件
                </span>
              )}
            </div>
          )}

          {product.product_variants?.length > 0 && (
            <div id="variant-picker" className="mb-5 scroll-mt-24">
              <p className="text-sm font-bold text-gray-700 mb-2">
                選擇規格
                {!selectedVariant && multiVariant && <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-[13px] font-bold text-amber-900">👇 請先點選一種</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.product_variants.filter(v => v.is_active).map(v => {
                  const oos = v.stock_qty <= 0
                  const sel = selectedVariant?.id === v.id
                  return (
                    <button key={v.id} onClick={() => { if (!oos) { setSelectedVariant(v); setQty(1) } }}
                      disabled={oos}
                      className={`px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all
                        ${sel ? 'border-green-600 bg-green-50 text-green-800 shadow-sm'
                          : oos ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 text-gray-700 hover:border-green-400 hover:bg-green-50/50'}`}>
                      {v.variant_name}
                      {/* 多種規格時每顆按鈕直接寫價格，比較時不用一個一個點 */}
                      {multiVariant && !oos && <span className={`ml-1.5 font-bold ${sel ? 'text-green-700' : 'text-gray-500'}`}>{formatPrice(v.sale_price)}</span>}
                      {oos && <span className="ml-1 text-red-400 font-normal">(售完)</span>}
                    </button>
                  )
                })}
              </div>
              {selectedVariant && (
                <p className="text-[13px] text-gray-600 mt-2 flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-red-400'}`} />
                  {inStock ? `庫存充足（${selectedVariant.stock_qty} 件）` : '此規格已售完'}
                </p>
              )}
            </div>
          )}

          {selectedVariant && inStock && (
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm font-bold text-gray-700">數量</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-11 h-11 rounded-xl border-2 border-gray-200 hover:border-green-500 font-bold text-xl flex items-center justify-center transition-colors">−</button>
                <span className="w-10 text-center font-bold text-xl">{qty}</span>
                <button onClick={() => setQty(q => Math.min(selectedVariant?.stock_qty || 1, q + 1))}
                  className="w-11 h-11 rounded-xl border-2 border-gray-200 hover:border-green-500 font-bold text-xl flex items-center justify-center transition-colors">+</button>
              </div>
            </div>
          )}

          <div className="hidden md:flex flex-row gap-3">
            <button onClick={handleAddToCart} disabled={!canBuy}
              className="flex-1 border-2 border-green-700 text-green-700 hover:bg-green-700 hover:text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {canBuy ? '加入購物車' : '已售完'}
            </button>
            <button onClick={handleBuyNow} disabled={!canBuy}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {canBuy ? '立即購買' : '已售完'}
            </button>
          </div>

          {product.short_intro && (
            <p className="mt-1 rounded-r-2xl border-l-4 border-green-600 bg-green-50/60 px-4 py-3 text-[16px] leading-[1.85] text-gray-800 md:mt-5">
              {product.short_intro}
            </p>
          )}
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {cats.map((cat: any) => (
                <span key={cat.id} className="text-[13px] bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full font-semibold border border-green-100">
                  {cat.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/*
        ─── 商品資訊：分頁籤＋三段 ───
        以前六張卡片一路往下排，手機上要滑很久、找不到想看的。改成跟台灣
        購物網站一樣：上方一排「商品介紹／成分規格／評價」分頁籤黏在表頭下，
        點了直接跳過去；長的介紹先收起來，成分與注意事項用摺疊列。
      */}
      <div className="mx-auto max-w-3xl">
        <SectionTabs items={tabs} />
        <div className="space-y-4">
          {hasIntro && (
            <section id="intro" className="scroll-mt-32 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="intro-heading">
              <h2 id="intro-heading" className="mb-4 text-[19px] font-bold text-gray-900">商品介紹</h2>
              <Collapsible maxHeight={420} moreLabel="展開完整介紹">
                <div className="divide-y divide-gray-100 text-[16px] leading-[1.85] text-gray-700">
                  {product.suitable_people && <SubBlock icon="👥" title="適合誰">{renderProductText(product.suitable_people)}</SubBlock>}
                  {timingLabels(product.intake_timing).length > 0 && (
                    <SubBlock icon="⏰" title="建議服用時間">
                      <div className="flex flex-wrap gap-2">
                        {timingLabels(product.intake_timing).map((l, i) => (
                          <span key={i} className="rounded-full bg-green-50 px-3 py-1.5 text-[14px] font-bold text-green-800">{l}</span>
                        ))}
                      </div>
                    </SubBlock>
                  )}
                  {product.usage_method && <SubBlock icon="📋" title="使用方法">{renderProductText(product.usage_method)}</SubBlock>}
                  {product.pairing_tips && <SubBlock icon="🔗" title="怎麼搭">{renderProductText(product.pairing_tips)}</SubBlock>}
                  {product.source_notes && <SubBlock icon="🌿" title="來源 / 挑選">{renderProductText(product.source_notes)}</SubBlock>}
                </div>
              </Collapsible>
            </section>
          )}

          {hasSpec && (
            <section id="spec" className="scroll-mt-32 rounded-2xl border border-gray-100 bg-white px-5 pb-2 pt-5 shadow-sm" aria-labelledby="spec-heading">
              <h2 id="spec-heading" className="mb-2 text-[19px] font-bold text-gray-900">成分與注意事項</h2>
              <div className="divide-y divide-gray-100">
                {product.ingredients && <Fold icon="🧪" title="成分說明" defaultOpen>{renderProductText(product.ingredients)}</Fold>}
                {product.precautions && <Fold icon="⚠️" title="注意事項" tone="amber" defaultOpen={!product.ingredients}>{renderProductText(product.precautions)}</Fold>}
                {product.storage_method && <Fold icon="📦" title="保存方式">{renderProductText(product.storage_method)}</Fold>}
              </div>
            </section>
          )}

          <ProductReviews productId={product.id} productSlug={product.slug} productName={product.product_name}
            initial={initialReviews} formOpen={reviewFormOpen} setFormOpen={setReviewFormOpen} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        {/* ─── 你可能也會喜歡 ─── 伺服器算好的 6 件：常一起買 > 同類 > 熱銷 */}
        <ProductRecommendations items={recommended} />

        {/*
          ─── 延伸閱讀（健康知識）───
          商品頁連到文章，補上「商品 → 文章」這個方向的內部連結。
          以前是三張大圖卡，手機上疊起來將近一整屏半，把頁面拉得很長；
          現在改成精簡清單：小縮圖＋標題＋閱讀時間，一篇一列約 80px。
          沒有夠相關的文章時整區不顯示 —— 推不相關的文章比不推更傷信任。
        */}
        {relatedArticles.length > 0 && (
          <section className="mt-8 rounded-2xl border border-gray-100 bg-white px-4 pb-1 pt-4 shadow-sm" aria-labelledby="related-articles-heading">
            <h2 id="related-articles-heading" className="text-[17px] font-bold text-gray-900">📚 延伸閱讀</h2>
            <ul className="mt-1 divide-y divide-gray-100">
              {relatedArticles.map(({ article, reason }) => (
                <li key={article.id}>
                  <Link href={`/health-articles/${article.slug}`} className="group flex items-center gap-3 py-3">
                    <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-green-50">
                      {article.cover_image_url
                        ? <Image src={article.cover_image_url} alt="" fill className="object-cover" sizes="56px" />
                        : <span className="flex h-full items-center justify-center text-xl">📖</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[15px] font-bold leading-snug text-gray-800 group-hover:text-green-700">
                        {article.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-gray-500">
                        {reason}{article.reading_minutes ? `・閱讀約 ${article.reading_minutes} 分鐘` : ''}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xl text-gray-300 group-hover:text-green-700" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Social share — LINE / Facebook / Copy */}
      <SocialShareButtons
        url={`${SITE_URL}/products/${product.slug}`}
        title={`${product.product_name} | 健康優選`}
        heading="把這款商品分享給家人朋友"
        subtext="覺得不錯的話，傳給可能用得上的人"
        theme="green"
      />

      {/* 底部固定購買列的墊片在 FrontShell（頁尾下面），這裡不再墊，否則頁尾上方會空一大段 */}

      {sheet && (
        <VariantPicker
          product={{ id: product.id, product_name: product.product_name, product_slug: product.slug, cover_image_url: product.cover_image_url, short_intro: product.short_intro, product_variants: product.product_variants }}
          preselect={false}
          initialVariantId={selectedVariant?.id}
          confirmLabel={sheet === 'buy' ? '立即購買' : sheet === 'cart' ? '加入購物車' : '確定'}
          onConfirm={confirmSheet}
          onClose={() => setSheet(null)}
        />
      )}

      {/*
        手機底部固定購買列。商品頁打開時，購買按鈕原本要往下捲過圖片、介紹、
        規格才看得到；改成一直固定在畫面底部，任何位置都能直接買。
        這一頁的底部導覽列（MobileBottomNav）會讓位給它。
        上面一行寫出目前選的規格與價格，避免客人沒注意就買到預設規格。
      */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bottom-skirt border-t border-gray-200 bg-white px-3 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        {selectedVariant ? (
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate text-gray-600">
              已選：<b className="text-gray-800">{selectedVariant.variant_name}</b>{qty > 1 && <> × {qty}</>}
            </span>
            <span className="flex flex-shrink-0 items-center gap-2">
              <b className="text-base text-green-700">{formatPrice(selectedVariant.sale_price * qty)}</b>
              {multiVariant && (
                <button type="button" className="font-bold text-green-700 underline underline-offset-2" onClick={() => setSheet('choose')}>
                  更換規格
                </button>
              )}
            </span>
          </div>
        ) : multiVariant && (
          // 還沒選規格：講清楚，點了直接跳出規格面板
          <button type="button" onClick={() => setSheet('choose')}
            className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-left text-[13px]">
            <span className="font-bold text-amber-900">⚠️ 尚未選擇規格（共 {activeVariants.length} 種）</span>
            <span className="flex flex-shrink-0 items-center gap-1.5"><b className="text-green-700">{priceRange}</b><span className="font-bold text-green-700 underline underline-offset-2">選規格</span></span>
          </button>
        )}
        <div className="flex items-stretch gap-2">
          <Link href="/cart" aria-label="購物車"
            className="relative flex w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-gray-200 text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[12px] font-bold text-white">{totalItems > 9 ? '9+' : totalItems}</span>
            )}
          </Link>
          <button onClick={handleAddToCart} disabled={!canBuy}
            className="min-h-[48px] flex-1 rounded-xl border-2 border-green-700 text-[15px] font-bold text-green-700 active:bg-green-50 disabled:opacity-40">
            {canBuy ? '加入購物車' : '已售完'}
          </button>
          <button onClick={handleBuyNow} disabled={!canBuy}
            className="min-h-[48px] flex-1 rounded-xl bg-green-700 text-[15px] font-bold text-white active:bg-green-800 disabled:opacity-40">
            {canBuy ? '立即購買' : '已售完'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 成分／注意事項／保存方式的摺疊列：點標題展開或收起（內容一直在 HTML 裡） */
function Fold({ icon, title, tone, defaultOpen, children }: {
  icon: string; title: string; tone?: 'amber'; defaultOpen?: boolean; children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group py-1">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 text-[17px] font-bold text-gray-900 [&::-webkit-details-marker]:hidden">
        <span aria-hidden>{icon}</span>
        <span className="flex-1">{title}</span>
        <span className="text-sm text-gray-400 transition-transform group-open:rotate-180" aria-hidden>▼</span>
      </summary>
      <div className={`mb-3 text-[16px] leading-[1.85] ${tone === 'amber' ? 'rounded-xl bg-amber-50 p-4 text-amber-900' : 'text-gray-700'}`}>
        {children}
      </div>
    </details>
  )
}

/** 情境化保健資訊裡的一小節：小標獨立一行，內容不再擠在 emoji 旁邊的窄欄 */
function SubBlock({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <h4 className="mb-2 flex items-center gap-2 text-[16px] font-bold text-green-800">
        <span aria-hidden>{icon}</span>{title}
      </h4>
      {children}
    </div>
  )
}
