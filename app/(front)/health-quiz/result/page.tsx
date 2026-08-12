import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import { analysisFromParams } from '@/lib/quizAnalysis'
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

function PlanRow({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div>
      <p className="font-bold text-gray-700 text-sm mb-1">{icon} {title}</p>
      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  )
}

function ProductMini({ product }: { product: any }) {
  const activeVariants = (product.product_variants || []).filter((v: any) => v.is_active && v.stock_qty > 0)
  const minPrice = activeVariants.length ? Math.min(...activeVariants.map((v: any) => v.sale_price)) : null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex gap-4 p-4">
      <Link href={`/products/${product.slug}`} className="flex-shrink-0">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 relative">
          {product.cover_image_url ? (
            <Image src={product.cover_image_url} alt={product.product_name} fill className="object-cover" sizes="80px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">💊</div>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <Link href={`/products/${product.slug}`}>
            <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 hover:text-green-700 line-clamp-2">{product.product_name}</h3>
          </Link>
          {product.short_intro && <p className="text-[13px] text-gray-500 line-clamp-2 mb-2">{product.short_intro}</p>}
          {minPrice !== null && <p className="text-green-700 font-bold text-base">{formatPrice(minPrice)}</p>}
        </div>
        <div className="mt-2">
          <Suspense fallback={null}><QuizResultCart product={product} /></Suspense>
        </div>
      </div>
    </div>
  )
}

export default async function QuizResultPage({
  searchParams,
}: {
  searchParams: { cats?: string; a?: string }
}) {
  const analysis = analysisFromParams({ a: searchParams.a, cats: searchParams.cats })
  const cats = analysis.cats
  const recommendations = await getResultData(cats)

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 text-3xl">
            🩺
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">您的個人化保健方案</h1>
          <p className="text-gray-500">先判斷您屬於哪一類，再給您飲食、生活與營養素的完整搭配</p>
        </div>

        {/* 個人化分析摘要 */}
        <div className="bg-gradient-to-br from-green-700 to-emerald-600 rounded-2xl p-5 text-white shadow-md mb-6">
          <p className="text-[13px] font-bold text-green-100 mb-1.5 tracking-wide">📋 個人化分析</p>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </div>

        {/* 每個方向：完整個人化方案（判斷 → 飲食 → 生活 → 營養素搭配 → 時間 → 來源）＋ 推薦商品 */}
        <div className="space-y-6 mb-8">
          {analysis.directions.map(d => {
            const products = recommendations.find(r => r.category === d.slug)?.products || []
            return (
              <section key={d.slug} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{d.icon}</span>
                    <h2 className="text-lg font-bold text-gray-900">{d.name}保健方案</h2>
                    {d.primary
                      ? <span className="text-[13px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">您關注的</span>
                      : <span className="text-[13px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">建議留意</span>}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{d.detailAdvice || d.advice}</p>
                </div>

                {d.plan && (
                  <div className="px-5 py-4 space-y-4">
                    <PlanRow icon="🍽️" title="飲食建議" text={d.plan.diet} />
                    <PlanRow icon="🏃" title="生活方式" text={d.plan.lifestyle} />
                    <div>
                      <p className="font-bold text-gray-700 text-sm mb-2">💊 營養素搭配（主力＋協同）</p>
                      <div className="space-y-1.5">
                        {d.plan.nutrients.map((n, i) => (
                          <div key={i} className="flex flex-wrap gap-x-2 text-sm">
                            <span className="font-bold text-green-700 flex-shrink-0">{n.name}</span>
                            {n.note && <span className="text-gray-500">— {n.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <PlanRow icon="⏰" title="服用時間" text={d.plan.timing} />
                    <PlanRow icon="🌿" title="來源 / 挑選重點" text={d.plan.source} />
                  </div>
                )}

                {products.length > 0 && (
                  <div className="px-5 py-4 bg-green-50/40 border-t border-gray-100">
                    <p className="font-bold text-gray-700 text-sm mb-3">🛒 推薦搭配的 {d.name} 保健品</p>
                    <div className="grid grid-cols-1 gap-3">
                      {products.map((product: any) => <ProductMini key={product.id} product={product} />)}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {/* Empty state */}
        {recommendations.length === 0 && (
          <div className="text-center py-10 text-gray-600">
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
          <p className="text-[13px] text-amber-600 leading-relaxed">
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
