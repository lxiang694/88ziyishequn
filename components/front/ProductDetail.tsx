'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { formatPrice } from '@/lib/utils'
import { timingLabels } from '@/lib/productMeta'
import { renderProductText } from '@/lib/productBlocks'
import ProductGallery from './ProductGallery'
import toast from 'react-hot-toast'
import SocialShareButtons from './SocialShareButtons'
import { PRESALE } from '@/lib/presale/camelliaOil'
import { SITE_URL } from '@/lib/siteUrl'
import type { ScoredArticle } from '@/lib/productArticleMatcher'


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

export default function ProductDetail({ product, relatedArticles = [] }: {
  product: Product
  /** 由伺服器算好傳進來；沒有夠相關的文章時為空陣列 */
  relatedArticles?: ScoredArticle[]
}) {
  const router = useRouter()
  const { addItem, totalItems } = useCart()

  const firstAvailable = product.product_variants?.find(v => v.is_active && v.stock_qty > 0)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    firstAvailable || product.product_variants?.[0] || null
  )
  const [qty, setQty] = useState(1)

  const allImages = [
    ...(product.cover_image_url ? [product.cover_image_url] : []),
    ...(product.product_images?.map(i => i.image_url) || []),
  ]
  const cats = product.product_category_relations?.map(r => r.health_categories).filter(Boolean) || []
  const inStock = (selectedVariant?.stock_qty ?? 0) > 0

  const handleAddToCart = () => {
    if (!selectedVariant) { toast.error('請選擇規格'); return }
    if (!inStock) { toast.error('此規格已售完'); return }
    addItem({
      product_id: product.id, product_name: product.product_name,
      product_slug: product.slug, cover_image_url: product.cover_image_url,
      variant_id: selectedVariant.id, variant_name: selectedVariant.variant_name,
      sku_code: selectedVariant.sku_code, unit_price: selectedVariant.sale_price,
      quantity: qty, stock_qty: selectedVariant.stock_qty,
    })
  }

  const handleBuyNow = () => {
    if (!selectedVariant || !inStock) return
    addItem({
      product_id: product.id, product_name: product.product_name,
      product_slug: product.slug, cover_image_url: product.cover_image_url,
      variant_id: selectedVariant.id, variant_name: selectedVariant.variant_name,
      sku_code: selectedVariant.sku_code, unit_price: selectedVariant.sale_price,
      quantity: qty, stock_qty: selectedVariant.stock_qty,
    })
    router.push('/checkout')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-14 pb-6 md:py-6">
      {/* Breadcrumb —— 手機上有浮動的「上一頁／首頁」，不再多佔一行 */}
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
              <p className="text-sm font-bold text-gray-700 mb-2">選擇規格</p>
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

          {inStock && (
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
            <button onClick={handleAddToCart} disabled={!inStock}
              className="flex-1 border-2 border-green-700 text-green-700 hover:bg-green-700 hover:text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {inStock ? '加入購物車' : '已售完'}
            </button>
            <button onClick={handleBuyNow} disabled={!inStock}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {inStock ? '立即購買' : '已售完'}
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

      {/* Detail sections —— 內文 16px、行距加寬；小節標題獨立一行，內容用滿整個寬度 */}
      <div className="space-y-4">
        {(product.suitable_people || timingLabels(product.intake_timing).length > 0 || product.pairing_tips || product.source_notes) && (
          <DetailCard icon="🎯" iconBg="bg-green-50" title="情境化保健資訊" highlight>
            <div className="divide-y divide-gray-100">
              {product.suitable_people && (
                <SubBlock icon="👥" title="適合誰">{renderProductText(product.suitable_people)}</SubBlock>
              )}
              {timingLabels(product.intake_timing).length > 0 && (
                <SubBlock icon="⏰" title="建議服用時間">
                  <div className="flex flex-wrap gap-2">
                    {timingLabels(product.intake_timing).map((l, i) => (
                      <span key={i} className="rounded-full bg-green-50 px-3 py-1.5 text-[14px] font-bold text-green-800">{l}</span>
                    ))}
                  </div>
                </SubBlock>
              )}
              {product.pairing_tips && <SubBlock icon="🔗" title="怎麼搭">{renderProductText(product.pairing_tips)}</SubBlock>}
              {product.source_notes && <SubBlock icon="🌿" title="來源 / 挑選">{renderProductText(product.source_notes)}</SubBlock>}
            </div>
          </DetailCard>
        )}
        {product.usage_method && <DetailCard icon="📋" iconBg="bg-green-50" title="使用方法">{renderProductText(product.usage_method)}</DetailCard>}
        {product.ingredients && <DetailCard icon="🧪" iconBg="bg-purple-50" title="成分說明">{renderProductText(product.ingredients)}</DetailCard>}
        {product.precautions && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[19px] font-bold text-amber-900">
              <span className="text-xl" aria-hidden>⚠️</span> 注意事項
            </h3>
            <div className="text-[16px] leading-[1.85] text-amber-900">{renderProductText(product.precautions)}</div>
          </div>
        )}
        {product.storage_method && <DetailCard icon="📦" iconBg="bg-gray-50" title="保存方式">{renderProductText(product.storage_method)}</DetailCard>}
      </div>

      {/*
        ─── 相關健康知識 ───
        站上原本只有「文章 → 商品」的推薦，沒有反方向。像紫蘇油這種
        主題，兩篇文章加一個商品三個頁面互不連結，客人看完商品不知道
        有文章可讀，搜尋引擎也看不出它們是同一個主題。
        沒有夠相關的文章時整區不顯示 —— 在紫蘇油頁推一篇講膝蓋的文章
        比沒有推薦更傷信任。
      */}
      {relatedArticles.length > 0 && (
        <section className="mt-8" aria-labelledby="related-articles-heading">
          <h2 id="related-articles-heading" className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
            <span className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-lg">📚</span>
            延伸閱讀
          </h2>
          <p className="text-gray-600 text-sm mb-4">想先了解再決定？這幾篇跟這款商品有關</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedArticles.map(({ article, reason }) => (
              <Link key={article.id} href={`/health-articles/${article.slug}`}
                className="group block rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {article.cover_image_url && (
                  <div className="relative aspect-[16/9] bg-gray-100">
                    <Image src={article.cover_image_url} alt="" fill className="object-cover"
                      sizes="(max-width: 640px) 100vw, 220px" />
                  </div>
                )}
                <div className="p-3.5">
                  <span className="inline-block text-[12px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full mb-1.5">
                    {reason}
                  </span>
                  <p className="font-bold text-gray-800 text-sm leading-snug line-clamp-3 group-hover:text-green-700 transition-colors">
                    {article.title}
                  </p>
                  {article.reading_minutes && (
                    <p className="text-gray-500 text-[13px] mt-1.5">閱讀約 {article.reading_minutes} 分鐘</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Social share — LINE / Facebook / Copy */}
      <SocialShareButtons
        url={`${SITE_URL}/products/${product.slug}`}
        title={`${product.product_name} | 健康優選`}
        heading="把這款商品分享給家人朋友"
        subtext="覺得不錯的話，傳給可能用得上的人"
        theme="green"
      />

      {/* 底部固定購買列的墊片：FrontShell 已經墊了導覽列的 60px，這裡補上購買列多出來的高度 */}
      <div className="md:hidden h-12" aria-hidden />

      {/*
        手機底部固定購買列。商品頁打開時，購買按鈕原本要往下捲過圖片、介紹、
        規格才看得到；改成一直固定在畫面底部，任何位置都能直接買。
        這一頁的底部導覽列（MobileBottomNav）會讓位給它。
        上面一行寫出目前選的規格與價格，避免客人沒注意就買到預設規格。
      */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-3 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        {selectedVariant && (
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate text-gray-600">
              已選：<b className="text-gray-800">{selectedVariant.variant_name}</b>{qty > 1 && <> × {qty}</>}
            </span>
            <span className="flex flex-shrink-0 items-center gap-2">
              <b className="text-base text-green-700">{formatPrice(selectedVariant.sale_price * qty)}</b>
              {product.product_variants.filter(v => v.is_active).length > 1 && (
                <button type="button" className="font-bold text-green-700 underline underline-offset-2"
                  onClick={() => document.getElementById('variant-picker')?.scrollIntoView({ behavior: 'smooth' })}>
                  更換規格
                </button>
              )}
            </span>
          </div>
        )}
        <div className="flex items-stretch gap-2">
          <Link href="/cart" aria-label="購物車"
            className="relative flex w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl border border-gray-200 text-gray-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[12px] font-bold text-white">{totalItems > 9 ? '9+' : totalItems}</span>
            )}
          </Link>
          <button onClick={handleAddToCart} disabled={!inStock}
            className="min-h-[48px] flex-1 rounded-xl border-2 border-green-700 text-[15px] font-bold text-green-700 active:bg-green-50 disabled:opacity-40">
            {inStock ? '加入購物車' : '已售完'}
          </button>
          <button onClick={handleBuyNow} disabled={!inStock}
            className="min-h-[48px] flex-1 rounded-xl bg-green-700 text-[15px] font-bold text-white active:bg-green-800 disabled:opacity-40">
            {inStock ? '立即購買' : '已售完'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 商品詳情的一張卡片：標題列＋內文（16px、行距 1.85） */
function DetailCard({ icon, iconBg, title, highlight, children }: {
  icon: string; iconBg: string; title: string; highlight?: boolean; children: React.ReactNode
}) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ${highlight ? 'border-2 border-green-100' : 'border border-gray-100'}`}>
      <h3 className="mb-4 flex items-center gap-2.5 text-[19px] font-bold text-gray-900">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${iconBg}`} aria-hidden>{icon}</span>
        {title}
      </h3>
      <div className="text-[16px] leading-[1.85] text-gray-700">{children}</div>
    </section>
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
