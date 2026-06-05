import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import { getSeverity, SLEEP_STRATEGIES, SLEEP_NUTRIENTS } from '@/lib/sleepQuizData'
import { rankSleepProducts, type SleepSeverity } from '@/lib/sleepProductMatcher'
import { buildSalesMap } from '@/lib/salesUtils'
import { formatPrice } from '@/lib/utils'
import QuizResultCart from '@/components/front/QuizResultCart'
import SocialShareButtons from '@/components/front/SocialShareButtons'
import LoginPrompt from '@/components/front/LoginPrompt'

export const dynamic = 'force-dynamic'

const SITE_URL = 'https://healthec.vercel.app'

export const metadata: Metadata = {
  title: '您的睡眠健康報告',
  description: '基於 ISI 國際標準的失眠嚴重度評估結果',
  alternates: { canonical: `${SITE_URL}/sleep-quiz/result` },
  robots: { index: false, follow: false },  // 個人化結果頁不索引
}

async function getRecommendations(severity: SleepSeverity) {
  // 從 sleep-relax 分類撈所有候選商品（不限 10 筆，讓演算法挑出最合適的）
  const { data: relations } = await supabaseAdmin
    .from('product_category_relations')
    .select('product_id, health_categories!inner(slug)')
    .eq('health_categories.slug', 'sleep-relax')
    .limit(100)

  const productIds = (relations || []).map((r: any) => r.product_id)

  let scored: any[] = []
  if (productIds.length > 0) {
    const [{ data: prods }, salesMap] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select(`
          id, product_name, slug, short_intro, ingredients, cover_image_url, created_at,
          product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active)
        `)
        .eq('is_published', true)
        .in('id', productIds),
      buildSalesMap(),  // automatically excludes cancelled orders
    ])

    // 智能評分：成分匹配 + 銷量 + 新品時效 + 庫存可用性
    scored = rankSleepProducts(prods || [], salesMap, severity, 3)
  }

  // 撈睡眠相關文章
  const { data: articles } = await supabaseAdmin
    .from('health_articles')
    .select('slug, title, excerpt, cover_image_url, reading_minutes')
    .eq('is_published', true)
    .eq('category_slug', 'sleep-relax')
    .limit(3)

  return { scoredProducts: scored, articles: articles || [] }
}

export default async function SleepQuizResult({
  searchParams,
}: {
  searchParams: { score?: string }
}) {
  const score = parseInt(searchParams.score || '0')
  const validScore = Math.max(0, Math.min(28, score))
  const severity = getSeverity(validScore)
  const { scoredProducts, articles } = await getRecommendations(severity.level as SleepSeverity)

  // 為這個等級挑選的策略
  const strategies = SLEEP_STRATEGIES.filter(s => s.forLevels.includes(severity.level))
  const recommendedStrategies = severity.level === 'green'
    ? strategies.slice(0, 1)
    : severity.level === 'yellow'
    ? strategies.slice(0, 3)
    : strategies.slice(0, 4)

  // 適合這個等級的營養素
  const nutrients = severity.level === 'green'
    ? []
    : SLEEP_NUTRIENTS.filter(n => n.forLevels.includes(severity.level as any))

  // 進度條的百分比（0-28 對應 0-100）
  const scorePercent = (validScore / 28) * 100

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 mb-2">您的睡眠健康報告</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">ISI 失眠嚴重度評估</h1>
          <p className="text-xs text-gray-400">基於國際標準量表 · {new Date().toLocaleDateString('zh-TW')}</p>
        </div>

        {/* Score card */}
        <div className={`bg-gradient-to-br ${severity.bgColor} rounded-3xl border-2 ${severity.borderColor} p-6 sm:p-8 mb-6`}>
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{severity.emoji}</div>
            <p className={`text-sm font-bold ${severity.accentColor} mb-1`}>{severity.shortDesc}</p>
            <h2 className={`text-2xl sm:text-3xl font-bold ${severity.textColor} mb-3`}>
              {severity.label}
            </h2>
          </div>

          {/* Score visualization */}
          <div className="bg-white/70 backdrop-blur rounded-2xl p-4 mb-4">
            <div className="flex items-baseline justify-center gap-2 mb-3">
              <span className={`text-5xl font-bold ${severity.accentColor}`}>{validScore}</span>
              <span className="text-gray-400 text-lg">/ 28 分</span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
              <div className="absolute inset-0 flex">
                <div className="bg-green-400" style={{ width: `${(8 / 28) * 100}%` }} />
                <div className="bg-yellow-400" style={{ width: `${(7 / 28) * 100}%` }} />
                <div className="bg-orange-400" style={{ width: `${(7 / 28) * 100}%` }} />
                <div className="bg-red-400" style={{ width: `${(7 / 28) * 100}%` }} />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-700 rounded-full shadow-lg transition-all"
                style={{ left: `calc(${scorePercent}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 px-1">
              <span>0</span>
              <span>8</span>
              <span>15</span>
              <span>22</span>
              <span>28</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 px-1 mt-0.5">
              <span>正常</span>
              <span>輕度</span>
              <span>中度</span>
              <span>重度</span>
            </div>
          </div>

          {/* Long description */}
          <p className={`text-sm leading-relaxed ${severity.textColor}`}>
            {severity.longDesc}
          </p>
        </div>

        {/* Red level: doctor referral */}
        {severity.level === 'red' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">🏥</span>
              <div>
                <p className="font-bold text-red-800 mb-1">建議您預約專業評估</p>
                <p className="text-sm text-red-700 leading-relaxed mb-3">
                  您的失眠程度已達重度，請優先諮詢以下專科：
                </p>
                <ul className="text-sm text-red-700 space-y-1 mb-3">
                  <li>· 各醫院神經內科 / 精神科 / 睡眠醫學中心</li>
                  <li>· 各省市的睡眠專科：北京大學第六醫院、復旦華山等</li>
                  <li>· 多導睡眠監測（PSG）是診斷 OSA 的金標準</li>
                </ul>
                <p className="text-xs text-red-600">
                  ⚠️ 失眠是可治療的——CBT-I 認知行為療法的有效率達 70-80%，且優於安眠藥
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recommended strategies */}
        {recommendedStrategies.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-base">🎯</span>
              為您挑選的改善策略
            </h2>
            <div className="space-y-3">
              {recommendedStrategies.map((s, i) => (
                <details key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 group" open={i === 0}>
                  <summary className="flex items-center gap-3 cursor-pointer list-none">
                    <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-base leading-snug">{s.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.oneliner}</p>
                    </div>
                    <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <ul className="mt-4 space-y-2 pl-11">
                    {s.steps.map((step, j) => (
                      <li key={j} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                        <span className="text-indigo-500 flex-shrink-0">·</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Nutrients */}
        {nutrients.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-base">🌿</span>
              適合您的營養素
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="space-y-3">
                {nutrients.map(n => (
                  <div key={n.name} className="flex gap-3 items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-bold
                      ${n.evidence === 'A' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {n.evidence} 級證據
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm">{n.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.mechanism}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center leading-relaxed">
                💡 證據等級為國際睡眠醫學會（AASM）共識，A 級證據最強
              </p>
            </div>
          </section>
        )}

        {/* Recommended products — smart matching */}
        {scoredProducts.length > 0 && severity.level !== 'green' && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-base">💊</span>
                為您智能推薦
              </h2>
              <span className="text-xs text-gray-400">依分數匹配 · 自動更新</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scoredProducts.map(({ product, reason, isNew }) => {
                const variants = (product.product_variants || []).filter((v: any) => v.is_active && v.stock_qty > 0)
                const minPrice = variants.length ? Math.min(...variants.map((v: any) => v.sale_price)) : null
                return (
                  <div key={product.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                    <Link href={`/products/${product.slug}`} className="block relative">
                      <div className="aspect-square bg-gray-50 relative">
                        {product.cover_image_url ? (
                          <Image src={product.cover_image_url} alt={product.product_name} fill
                            className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">💊</div>
                        )}
                        {isNew && (
                          <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                            ✨ 新品
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="p-3 flex flex-col flex-1">
                      {/* Match reason tag */}
                      <div className="mb-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full leading-tight">
                          🎯 {reason}
                        </span>
                      </div>
                      <Link href={`/products/${product.slug}`}>
                        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-indigo-700 mb-1">
                          {product.product_name}
                        </h3>
                      </Link>
                      {minPrice !== null && (
                        <p className="text-indigo-700 font-bold text-base mb-2 mt-auto">{formatPrice(minPrice)}</p>
                      )}
                      <QuizResultCart product={product} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center leading-relaxed">
              推薦邏輯：依您的失眠等級匹配成分（GABA、褪黑激素、鎂等）+ 銷量 + 新品時效。<br />
              管理員新增的睡眠保健品會自動納入推薦池。
            </p>
          </section>
        )}

        {/* Articles */}
        {articles.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-base">📚</span>
              延伸閱讀
            </h2>
            <div className="space-y-2">
              {articles.map(a => (
                <Link
                  key={a.slug}
                  href={`/health-articles/${a.slug}`}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-center hover:border-amber-300 transition-colors"
                >
                  {a.cover_image_url && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 relative flex-shrink-0">
                      <Image src={a.cover_image_url} alt={a.title} fill className="object-cover" sizes="64px" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{a.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">📖 約 {a.reading_minutes} 分鐘</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Retest reminder */}
        {severity.level !== 'green' && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6 text-center">
            <p className="text-2xl mb-2">📅</p>
            <p className="font-bold text-indigo-900 text-base mb-1">4 週後別忘了回來重測</p>
            <p className="text-sm text-indigo-700 leading-relaxed">
              堅持執行 3-5 條改善策略 4 週後，重新測一次<br />
              ISI 平均能下降 6-9 分——進步是可以被測量的
            </p>
          </div>
        )}

        {/* Deep dive section */}
        <section className="mb-6">
          <div className="bg-white rounded-3xl border-2 border-indigo-100 p-6">
            <p className="text-sm text-gray-500 font-bold mb-1 tracking-wide">想做更深入評估？</p>
            <p className="text-base font-bold text-gray-800 mb-4">三個進階工具幫您看清全貌</p>
            <div className="space-y-3">
              <Link href="/sleep-quiz/psqi"
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-300 hover:bg-purple-50/40 transition-all">
                <span className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🌙</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-base">PSQI 完整評估（19 題）</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">7 個成份分項打分 + 睡眠效率計算，醫學黃金標準</p>
                </div>
                <span className="text-purple-400 text-lg flex-shrink-0">→</span>
              </Link>

              <Link href="/sleep-quiz/ess"
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50/40 transition-all">
                <span className="w-12 h-12 bg-cyan-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">😴</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-base">ESS 日間嗜睡量表（8 題）</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">篩查睡眠呼吸中止症（OSA）與發作性睡病</p>
                </div>
                <span className="text-cyan-400 text-lg flex-shrink-0">→</span>
              </Link>

              <Link href="/sleep-tracker"
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all">
                <span className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">📅</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-base">21 天習慣養成計畫</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">每天打卡 8 個睡眠關鍵習慣，4 週後重測看改善</p>
                </div>
                <span className="text-emerald-400 text-lg flex-shrink-0">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Login prompt — for guests, suggest signup */}
        <LoginPrompt
          theme="indigo"
          title="註冊會員，下次更便利"
          message="成為健康優選會員，享受更多服務"
          next="/sleep-quiz"
        />

        {/* Social share */}
        <SocialShareButtons
          url={`${SITE_URL}/sleep-quiz`}
          title="2 分鐘測試你的失眠程度（國際 ISI 量表）"
          heading="把睡眠自測分享給家人朋友"
          subtext="一起重視睡眠品質"
          theme="indigo"
        />

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-center">
          <p className="text-xs text-amber-700 leading-relaxed">
            ⚠️ 本測驗結果僅供參考，不替代醫療診斷。
            如有嚴重失眠困擾或合併情緒、心血管問題，請諮詢專科醫師。
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/sleep-quiz"
            className="flex-1 text-center border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl hover:border-indigo-400 hover:text-indigo-700 transition-colors"
          >
            重新測驗
          </Link>
          <Link
            href="/"
            className="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-colors"
          >
            查看更多商品
          </Link>
        </div>
      </div>
    </div>
  )
}
