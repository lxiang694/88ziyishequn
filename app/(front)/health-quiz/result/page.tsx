import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import { DIRECTION_INFO } from '@/lib/quizData'
import QuizResultCart from '@/components/front/QuizResultCart'
import SocialShareButtons from '@/components/front/SocialShareButtons'
import LoginPrompt from '@/components/front/LoginPrompt'
import { formatPrice } from '@/lib/utils'

const SITE_URL = 'https://healthec.vercel.app'

export const dynamic = 'force-dynamic'

async function getResultData(cats: string[]) {
  // Fetch products for each category + sales data in parallel
  const [salesRes, ...productResults] = await Promise.all([
    supabaseAdmin.from('order_items').select('product_id, quantity'),
    ...cats.map(cat =>
      supabaseAdmin
        .from('products')
        .select(`
          id, product_name, slug, short_intro, cover_image_url,
          product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active),
          product_category_relations!inner(health_categories!inner(id, name, slug))
        `)
        .eq('is_published', true)
        .eq('product_category_relations.health_categories.slug', cat)
        .limit(10)
    ),
  ])

  // Build sales map
  const salesMap: Record<number, number> = {}
  for (const item of salesRes.data || []) {
    salesMap[item.product_id] = (salesMap[item.product_id] || 0) + item.quantity
  }

  // Collect top 3 products per category (dedup by id across categories)
  const seen = new Set<number>()
  const recommendations: { category: string; products: any[] }[] = []

  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i]
    const raw = productResults[i].data || []
    const sorted = raw
      .filter(p => !seen.has(p.id))
      .sort((a: any, b: any) => (salesMap[b.id] || 0) - (salesMap[a.id] || 0))
      .slice(0, 3)
    sorted.forEach((p: any) => seen.add(p.id))
    if (sorted.length > 0) {
      recommendations.push({ category: cat, products: sorted })
    }
  }

  return recommendations
}

export default async function QuizResultPage({
  searchParams,
}: {
  searchParams: { cats?: string }
}) {
  const catsParam = searchParams.cats || 'immune'
  const cats = catsParam.split(',').filter(c => DIRECTION_INFO[c])
  const recommendations = await getResultData(cats)

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 text-3xl">
            🩺
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">您的個人化保健建議</h1>
          <p className="text-gray-500">根據您的健康狀況，為您篩選最適合的保健品</p>
        </div>

        {/* Health direction summaries */}
        <div className="space-y-2 mb-8">
          {cats.map(cat => {
            const info = DIRECTION_INFO[cat]
            if (!info) return null
            return (
              <div key={cat} className="bg-white rounded-2xl border border-green-100 p-4 flex gap-3 items-start shadow-sm">
                <span className="text-2xl flex-shrink-0 mt-0.5">{info.icon}</span>
                <div>
                  <p className="font-bold text-gray-800 mb-0.5">{info.name}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{info.advice}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Product recommendations per category */}
        {recommendations.map(({ category, products }) => {
          const info = DIRECTION_INFO[category]
          return (
            <section key={category} className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>{info?.icon}</span>
                <span>推薦 {info?.name} 保健品</span>
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {products.map(product => {
                  const activeVariants = (product.product_variants || []).filter(
                    (v: any) => v.is_active && v.stock_qty > 0
                  )
                  const minPrice = activeVariants.length
                    ? Math.min(...activeVariants.map((v: any) => v.sale_price))
                    : null
                  const inStock = activeVariants.length > 0

                  return (
                    <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex gap-4 p-4">
                      {/* Image */}
                      <Link href={`/products/${product.slug}`} className="flex-shrink-0">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 relative">
                          {product.cover_image_url ? (
                            <Image
                              src={product.cover_image_url}
                              alt={product.product_name}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">💊</div>
                          )}
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <Link href={`/products/${product.slug}`}>
                            <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 hover:text-green-700 line-clamp-2">
                              {product.product_name}
                            </h3>
                          </Link>
                          {product.short_intro && (
                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{product.short_intro}</p>
                          )}
                          {minPrice !== null && (
                            <p className="text-green-700 font-bold text-base">{formatPrice(minPrice)}</p>
                          )}
                        </div>

                        {/* Cart button — client component */}
                        <div className="mt-2">
                          <Suspense fallback={null}>
                            <QuizResultCart product={product} />
                          </Suspense>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* Empty state */}
        {recommendations.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-5xl mb-4">🔍</p>
            <p>目前沒有找到符合的商品，請查看所有商品</p>
          </div>
        )}

        {/* Login prompt */}
        <LoginPrompt
          theme="green"
          title="註冊會員，下次更便利"
          message="成為健康優選會員，享受更多服務"
          next="/health-quiz"
        />

        {/* Social share */}
        <SocialShareButtons
          url={`${SITE_URL}/health-quiz`}
          title="2 分鐘健康自測：找出你最適合的保健方向"
          heading="把這個自測分享給朋友"
          subtext="一起重視健康"
          theme="green"
        />

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-center">
          <p className="text-sm text-amber-700 font-semibold mb-1">⚠️ 健康聲明</p>
          <p className="text-xs text-amber-600 leading-relaxed">
            本測驗結果僅供參考，所有保健品補充請先諮詢您的主治醫師。
            本網站所有商品非藥品，不具備診斷、治療或預防疾病之效果。
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 text-center border-2 border-gray-200 text-gray-600 font-bold py-4 rounded-2xl text-base hover:border-green-400 hover:text-green-700 transition-colors"
          >
            查看所有商品
          </Link>
          <Link
            href="/health-quiz"
            className="flex-1 text-center bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition-colors"
          >
            重新測驗
          </Link>
        </div>
      </div>
    </div>
  )
}
