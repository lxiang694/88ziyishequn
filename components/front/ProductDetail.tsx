'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import { formatPrice } from '@/lib/utils'
import { timingLabels } from '@/lib/productMeta'
import toast from 'react-hot-toast'
import SocialShareButtons from './SocialShareButtons'

const SITE_URL = 'https://healthec.vercel.app'

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

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter()
  const { addItem } = useCart()

  const firstAvailable = product.product_variants?.find(v => v.is_active && v.stock_qty > 0)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    firstAvailable || product.product_variants?.[0] || null
  )
  const [qty, setQty] = useState(1)
  const [activeImage, setActiveImage] = useState<string | null>(product.cover_image_url)

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
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href="/" className="hover:text-green-700 transition-colors">首頁</Link>
        <span>›</span>
        <span className="text-gray-700 line-clamp-1">{product.product_name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Images */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative mb-3 shadow-sm">
            {activeImage ? (
              <Image src={activeImage} alt={product.product_name} fill className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw" priority />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl text-gray-200">💊</div>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(img)}
                  className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors
                    ${activeImage === img ? 'border-green-600' : 'border-gray-200 hover:border-green-300'}`}>
                  <Image src={img} alt="" width={64} height={64} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-2 mb-3">
            {cats.map((cat: any) => (
              <span key={cat.id} className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full font-semibold border border-green-100">
                {cat.name}
              </span>
            ))}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 leading-snug">{product.product_name}</h1>
          {product.short_intro && (
            <p className="text-gray-600 text-base leading-relaxed mb-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {product.short_intro}
            </p>
          )}

          {/* Sales count — social proof, only if >= 5 */}
          {(product.sales_count || 0) >= 5 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-700 px-3 py-2 rounded-xl mb-4 text-sm font-bold">
              <span className="text-lg leading-none">🔥</span>
              <span>
                {(product.sales_count || 0) >= 100 ? '熱銷商品 · ' : ''}
                已售出 <span className="text-orange-800 text-base">{product.sales_count}</span> 件
              </span>
            </div>
          )}

          {selectedVariant && (
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-3xl font-bold text-green-700">{formatPrice(selectedVariant.sale_price)}</span>
              {selectedVariant.original_price && selectedVariant.original_price > selectedVariant.sale_price && (
                <>
                  <span className="text-gray-600 line-through text-lg">{formatPrice(selectedVariant.original_price)}</span>
                  <span className="bg-red-50 text-red-600 text-sm font-bold px-2 py-0.5 rounded-lg">
                    省 {formatPrice(selectedVariant.original_price - selectedVariant.sale_price)}
                  </span>
                </>
              )}
            </div>
          )}

          {product.product_variants?.length > 0 && (
            <div className="mb-5">
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

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleAddToCart} disabled={!inStock}
              className="flex-1 border-2 border-green-700 text-green-700 hover:bg-green-700 hover:text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {inStock ? '加入購物車' : '已售完'}
            </button>
            <button onClick={handleBuyNow} disabled={!inStock}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {inStock ? '立即購買' : '已售完'}
            </button>
          </div>
        </div>
      </div>

      {/* Detail sections */}
      <div className="space-y-4">
        {(product.suitable_people || timingLabels(product.intake_timing).length > 0 || product.pairing_tips || product.source_notes) && (
          <div className="bg-white rounded-2xl border-2 border-green-100 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-lg">🎯</span>
              情境化保健資訊
            </h3>
            <div className="space-y-3.5">
              {product.suitable_people && (
                <div className="flex gap-3">
                  <span className="text-xl flex-shrink-0">👥</span>
                  <div><p className="font-bold text-gray-700 text-sm mb-0.5">適合誰</p><p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{product.suitable_people}</p></div>
                </div>
              )}
              {timingLabels(product.intake_timing).length > 0 && (
                <div className="flex gap-3">
                  <span className="text-xl flex-shrink-0">⏰</span>
                  <div>
                    <p className="font-bold text-gray-700 text-sm mb-1">建議服用時間</p>
                    <div className="flex flex-wrap gap-1.5">
                      {timingLabels(product.intake_timing).map((l, i) => (
                        <span key={i} className="text-[13px] font-bold bg-green-50 text-green-800 px-3 py-1.5 rounded-full">{l}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {product.pairing_tips && (
                <div className="flex gap-3">
                  <span className="text-xl flex-shrink-0">🔗</span>
                  <div><p className="font-bold text-gray-700 text-sm mb-0.5">怎麼搭</p><p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{product.pairing_tips}</p></div>
                </div>
              )}
              {product.source_notes && (
                <div className="flex gap-3">
                  <span className="text-xl flex-shrink-0">🌿</span>
                  <div><p className="font-bold text-gray-700 text-sm mb-0.5">來源 / 挑選</p><p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{product.source_notes}</p></div>
                </div>
              )}
            </div>
          </div>
        )}
        {product.usage_method && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-lg">📋</span>
              使用方法
            </h3>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line">{product.usage_method}</div>
          </div>
        )}
        {product.ingredients && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-lg">🧪</span>
              成分說明
            </h3>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line">{product.ingredients}</div>
          </div>
        )}
        {product.precautions && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
              <span className="text-xl">⚠️</span> 注意事項
            </h3>
            <div className="text-amber-700 leading-relaxed whitespace-pre-line">{product.precautions}</div>
          </div>
        )}
        {product.storage_method && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-lg">📦</span>
              保存方式
            </h3>
            <div className="text-gray-600 leading-relaxed">{product.storage_method}</div>
          </div>
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
    </div>
  )
}
