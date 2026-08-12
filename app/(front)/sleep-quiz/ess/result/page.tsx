import type { Metadata } from 'next'
import Link from 'next/link'
import { getESSLevel } from '@/lib/sleepQuizData'
import SocialShareButtons from '@/components/front/SocialShareButtons'
import LoginPrompt from '@/components/front/LoginPrompt'

const SITE_URL = 'https://healthec.vercel.app'

export const metadata: Metadata = {
  title: 'ESS 日間嗜睡報告',
  description: 'ESS 量表評估結果 + OSA 篩查',
  robots: { index: false, follow: false },
}

export default function ESSResult({
  searchParams,
}: { searchParams: { score?: string; snoring?: string } }) {
  const score = parseInt(searchParams.score || '0')
  const validScore = Math.max(0, Math.min(24, score))
  const snoring = searchParams.snoring === '1'
  const level = getESSLevel(validScore)

  // OSA 高度懷疑：ESS ≥ 10 且打鼾嚴重
  const highOSARisk = validScore >= 10 && snoring

  const colorMap: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    green: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-900', accent: 'text-green-700' },
    yellow: { bg: 'from-yellow-50 to-amber-50', border: 'border-yellow-200', text: 'text-yellow-900', accent: 'text-yellow-700' },
    orange: { bg: 'from-orange-50 to-amber-100', border: 'border-orange-200', text: 'text-orange-900', accent: 'text-orange-700' },
    red: { bg: 'from-red-50 to-rose-50', border: 'border-red-200', text: 'text-red-900', accent: 'text-red-700' },
  }
  const c = colorMap[level.color]

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-2">您的 ESS 報告</p>
          <h1 className="text-2xl font-bold text-gray-900">愛潑沃斯嗜睡量表</h1>
          <p className="text-[13px] text-gray-600 mt-1">日間嗜睡篩查 · {new Date().toLocaleDateString('zh-TW')}</p>
        </div>

        {/* OSA 紅色警告 — 最重要的提示放最上方 */}
        {highOSARisk && (
          <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-4xl flex-shrink-0">🚨</span>
              <div>
                <p className="font-bold text-red-800 text-lg mb-1">高度懷疑：阻塞性睡眠呼吸中止症（OSA）</p>
                <p className="text-sm text-red-700 leading-relaxed mb-3">
                  您的 ESS 分數 <strong>≥ 10 分</strong>，且觀察到 <strong>打鼾很響 / 呼吸暫停</strong>——
                  這兩個信號疊加時，OSA 的可能性就非常高了。
                </p>
                <div className="bg-white/70 rounded-xl p-3 mb-3">
                  <p className="text-sm font-bold text-red-800 mb-1">⚠️ OSA 長期不治療的後果</p>
                  <ul className="text-[13px] text-red-700 space-y-0.5">
                    <li>· 顯著抬高心血管疾病、腦卒中風險</li>
                    <li>· 增加猝死風險</li>
                    <li>· 中華醫學會 2024 版指南特別強調此組合需單獨關注</li>
                  </ul>
                </div>
                <p className="text-sm font-bold text-red-800">
                  建議盡快做多導睡眠監測（PSG）— 這是診斷 OSA 的金標準
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main score */}
        <div className={`bg-gradient-to-br ${c.bg} rounded-3xl border-2 ${c.border} p-6 sm:p-8 mb-6`}>
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{level.emoji}</div>
            <h2 className={`text-2xl sm:text-3xl font-bold ${c.text} mb-2`}>{level.label}</h2>
            <p className={`text-sm ${c.accent}`}>{level.desc}</p>
          </div>

          <div className="bg-white/70 backdrop-blur rounded-2xl p-4">
            <div className="flex items-baseline justify-center gap-2 mb-3">
              <span className={`text-5xl font-bold ${c.accent}`}>{validScore}</span>
              <span className="text-gray-600 text-lg">/ 24 分</span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
              <div className="absolute inset-0 flex">
                <div className="bg-green-400" style={{ width: `${(8 / 24) * 100}%` }} />
                <div className="bg-yellow-400" style={{ width: `${(2 / 24) * 100}%` }} />
                <div className="bg-orange-400" style={{ width: `${(6 / 24) * 100}%` }} />
                <div className="bg-red-400" style={{ width: `${(8 / 24) * 100}%` }} />
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-700 rounded-full shadow-lg"
                style={{ left: `calc(${(validScore / 24) * 100}% - 8px)` }} />
            </div>
            <div className="flex justify-between text-[13px] text-gray-500 px-1 mt-1">
              <span>0</span><span>8</span><span>10</span><span>16</span><span>24</span>
            </div>
            <div className="flex justify-between text-[13px] text-gray-600 px-1 mt-0.5">
              <span>正常</span><span>輕</span><span>中</span><span>重</span>
            </div>
          </div>
        </div>

        {level.warning && !highOSARisk && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <p className="font-bold text-amber-900 mb-2 flex items-center gap-2">⚠️ 重要提醒</p>
            <p className="text-sm text-amber-800 leading-relaxed">{level.warning}</p>
          </div>
        )}

        {/* What is OSA */}
        <details className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 group">
          <summary className="font-bold text-gray-700 cursor-pointer list-none flex items-center justify-between">
            <span>🔍 什麼是阻塞性睡眠呼吸中止症（OSA）？</span>
            <span className="text-gray-600 text-[13px] group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 text-sm text-gray-600 leading-relaxed space-y-2">
            <p>
              OSA（Obstructive Sleep Apnea）是睡眠時上呼吸道反覆塌陷阻塞，造成呼吸暫停或變淺的疾病。
            </p>
            <p>
              <strong>常見徵兆</strong>：響亮打鼾 + 旁人觀察到呼吸暫停 + 清晨頭痛 + 白天總是犯睏
            </p>
            <p>
              <strong>高風險族群</strong>：肥胖、頸圍粗、男性、停經後女性
            </p>
            <p>
              <strong>金標準診斷</strong>：多導睡眠監測（PSG），在睡眠專科進行
            </p>
            <p>
              <strong>治療方式</strong>：減重、CPAP 陽壓呼吸器、口腔牙套、手術等
            </p>
          </div>
        </details>

        {/* ESS reference table */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <p className="font-bold text-gray-700 text-base mb-3">ESS 分數對照表</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="flex items-center gap-2">🟢 <strong>0-7 分</strong></span>
              <span className="text-gray-500">正常</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="flex items-center gap-2">🟡 <strong>8-9 分</strong></span>
              <span className="text-gray-500">輕度日間嗜睡</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="flex items-center gap-2">🟠 <strong>10-15 分</strong></span>
              <span className="text-gray-500">建議排查 OSA</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="flex items-center gap-2">🔴 <strong>16-24 分</strong></span>
              <span className="text-gray-500">強烈建議就醫</span>
            </div>
          </div>
        </div>

        {/* Login prompt */}
        <LoginPrompt
          theme="indigo"
          title="註冊會員，下次更便利"
          message="成為健康優選會員，享受更多服務"
          next="/sleep-quiz/ess"
        />

        {/* Social share */}
        <SocialShareButtons
          url={`${SITE_URL}/sleep-quiz`}
          title="ESS 嗜睡量表 + 睡眠呼吸中止症（OSA）篩查"
          heading="分享給可能需要的家人"
          subtext="OSA 是常被忽略但會增加心血管風險的疾病"
          theme="indigo"
        />

        {/* Tools grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Link href="/sleep-quiz/start" className="bg-white border-2 border-gray-100 hover:border-cyan-300 rounded-2xl p-4 text-center transition-colors">
            <div className="text-3xl mb-1">📊</div>
            <p className="font-bold text-gray-800 text-sm">ISI 量表</p>
            <p className="text-[13px] text-gray-600 mt-0.5">失眠嚴重度</p>
          </Link>
          <Link href="/sleep-quiz/psqi" className="bg-white border-2 border-gray-100 hover:border-cyan-300 rounded-2xl p-4 text-center transition-colors">
            <div className="text-3xl mb-1">🌙</div>
            <p className="font-bold text-gray-800 text-sm">PSQI 完整評估</p>
            <p className="text-[13px] text-gray-600 mt-0.5">19 題深入版</p>
          </Link>
          <Link href="/sleep-tracker" className="bg-white border-2 border-gray-100 hover:border-cyan-300 rounded-2xl p-4 text-center transition-colors">
            <div className="text-3xl mb-1">📅</div>
            <p className="font-bold text-gray-800 text-sm">21 天打卡</p>
            <p className="text-[13px] text-gray-600 mt-0.5">習慣養成</p>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/sleep-quiz" className="flex-1 text-center border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl hover:border-cyan-400 hover:text-cyan-700 transition-colors">
            返回首頁
          </Link>
          <Link href="/sleep-quiz/ess" className="flex-1 text-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3.5 rounded-2xl transition-colors">
            重新測驗
          </Link>
        </div>
      </div>
    </div>
  )
}
