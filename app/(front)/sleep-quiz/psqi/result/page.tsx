import type { Metadata } from 'next'
import Link from 'next/link'
import { getPSQILevel } from '@/lib/sleepQuizData'
import SocialShareButtons from '@/components/front/SocialShareButtons'
import LoginPrompt from '@/components/front/LoginPrompt'

const SITE_URL = 'https://healthec.vercel.app'

export const metadata: Metadata = {
  title: 'PSQI 睡眠品質報告',
  description: 'PSQI 完整睡眠品質評估結果',
  robots: { index: false, follow: false },
}

const COMPONENT_LABELS = [
  { key: 'A', label: '主觀睡眠品質' },
  { key: 'B', label: '入睡時間' },
  { key: 'C', label: '睡眠時間長度' },
  { key: 'D', label: '睡眠效率' },
  { key: 'E', label: '睡眠障礙' },
  { key: 'F', label: '催眠藥物使用' },
  { key: 'G', label: '日間功能障礙' },
]

export default function PSQIResult({
  searchParams,
}: { searchParams: { score?: string; eff?: string } }) {
  const score = parseInt(searchParams.score || '0')
  const validScore = Math.max(0, Math.min(21, score))
  const efficiency = parseInt(searchParams.eff || '0')
  const level = getPSQILevel(validScore)

  const colorMap: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    green: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-900', accent: 'text-green-700' },
    yellow: { bg: 'from-yellow-50 to-amber-50', border: 'border-yellow-200', text: 'text-yellow-900', accent: 'text-yellow-700' },
    orange: { bg: 'from-orange-50 to-amber-100', border: 'border-orange-200', text: 'text-orange-900', accent: 'text-orange-700' },
    red: { bg: 'from-red-50 to-rose-50', border: 'border-red-200', text: 'text-red-900', accent: 'text-red-700' },
  }
  const c = colorMap[level.color]

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-2">您的 PSQI 報告</p>
          <h1 className="text-2xl font-bold text-gray-900">匹茲堡睡眠品質指數</h1>
          <p className="text-xs text-gray-400 mt-1">完整版 19 題評估 · {new Date().toLocaleDateString('zh-TW')}</p>
        </div>

        {/* Main score */}
        <div className={`bg-gradient-to-br ${c.bg} rounded-3xl border-2 ${c.border} p-6 sm:p-8 mb-6`}>
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">{level.emoji}</div>
            <h2 className={`text-2xl sm:text-3xl font-bold ${c.text} mb-2`}>{level.label}</h2>
          </div>

          <div className="bg-white/70 backdrop-blur rounded-2xl p-4 mb-4">
            <div className="flex items-baseline justify-center gap-2 mb-3">
              <span className={`text-5xl font-bold ${c.accent}`}>{validScore}</span>
              <span className="text-gray-400 text-lg">/ 21 分</span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
              <div className="absolute inset-0 flex">
                <div className="bg-green-400" style={{ width: `${(6 / 21) * 100}%` }} />
                <div className="bg-yellow-400" style={{ width: `${(5 / 21) * 100}%` }} />
                <div className="bg-orange-400" style={{ width: `${(5 / 21) * 100}%` }} />
                <div className="bg-red-400" style={{ width: `${(5 / 21) * 100}%` }} />
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-700 rounded-full shadow-lg"
                style={{ left: `calc(${(validScore / 21) * 100}% - 8px)` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 px-1 mt-1">
              <span>0</span><span>6</span><span>11</span><span>16</span><span>21</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 px-1 mt-0.5">
              <span>優秀</span><span>尚可</span><span>較差</span><span>很差</span>
            </div>
          </div>

          <p className={`text-sm leading-relaxed ${c.text}`}>{level.desc}</p>
        </div>

        {/* Sleep efficiency stat */}
        {efficiency > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-0.5">您的睡眠效率</p>
                <p className={`text-2xl font-bold ${efficiency >= 85 ? 'text-green-700' : efficiency >= 75 ? 'text-yellow-700' : efficiency >= 65 ? 'text-orange-700' : 'text-red-700'}`}>
                  {efficiency}%
                </p>
                <p className="text-xs text-gray-400 mt-1">健康人應該 ≥ 85%</p>
              </div>
              <div className="text-right text-xs text-gray-400 leading-relaxed">
                睡眠效率 = <br />
                實際睡眠 ÷ 在床時間 × 100%
              </div>
            </div>
          </div>
        )}

        {/* Interpretation guide */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <p className="font-bold text-gray-700 text-base mb-3">PSQI 分數對照表</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="flex items-center gap-2">🟢 <strong>0-5 分</strong>　優秀</span>
              <span className="text-gray-500">維持現有作息</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="flex items-center gap-2">🟡 <strong>6-10 分</strong>　尚可</span>
              <span className="text-gray-500">輕度問題</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="flex items-center gap-2">🟠 <strong>11-15 分</strong>　較差</span>
              <span className="text-gray-500">中度睡眠問題</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="flex items-center gap-2">🔴 <strong>16-21 分</strong>　很差</span>
              <span className="text-gray-500">嚴重睡眠問題</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            💡 在華人族群中，PSQI {'>'}  7 分已被視為睡眠品質差的篩查閾值
          </p>
        </div>

        {/* Next steps */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 mb-6">
          <p className="font-bold text-purple-900 text-base mb-2">建議的下一步</p>
          <ul className="text-sm text-purple-800 space-y-2 leading-relaxed">
            {level.color === 'green' && <li>· 繼續維持現有作息，建議 6 個月後重測一次</li>}
            {(level.color === 'yellow' || level.color === 'orange') && (
              <>
                <li>· 開始 21 天習慣養成計畫，每天打卡追蹤</li>
                <li>· 4 週後回來重測 PSQI，看看分數變化</li>
                <li>· 配合 ISI 量表追蹤失眠嚴重度</li>
              </>
            )}
            {level.color === 'red' && (
              <>
                <li>· <strong>建議預約睡眠專科或精神科門診</strong></li>
                <li>· 同時做 ESS 量表，篩查睡眠呼吸中止症</li>
                <li>· CBT-I 認知行為療法的有效率 70-80%，優於安眠藥</li>
              </>
            )}
          </ul>
        </div>

        {/* Login prompt */}
        <LoginPrompt
          theme="indigo"
          title="註冊會員，下次更便利"
          message="成為健康優選會員，享受更多服務"
          next="/sleep-quiz/psqi"
        />

        {/* Social share */}
        <SocialShareButtons
          url={`${SITE_URL}/sleep-quiz`}
          title="PSQI 完整睡眠評估（國際黃金標準）"
          heading="把睡眠評估分享給家人"
          subtext="一起重視睡眠品質"
          theme="indigo"
        />

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-center">
          <p className="text-xs text-amber-700 leading-relaxed">
            ⚠️ 本評估僅供參考，不替代醫療診斷
          </p>
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Link href="/sleep-tracker" className="bg-white border-2 border-gray-100 hover:border-indigo-300 rounded-2xl p-4 text-center transition-colors">
            <div className="text-3xl mb-1">📅</div>
            <p className="font-bold text-gray-800 text-sm">21 天打卡</p>
            <p className="text-xs text-gray-400 mt-0.5">習慣養成計畫</p>
          </Link>
          <Link href="/sleep-quiz/ess" className="bg-white border-2 border-gray-100 hover:border-indigo-300 rounded-2xl p-4 text-center transition-colors">
            <div className="text-3xl mb-1">😴</div>
            <p className="font-bold text-gray-800 text-sm">ESS 量表</p>
            <p className="text-xs text-gray-400 mt-0.5">日間嗜睡篩查</p>
          </Link>
          <Link href="/sleep-quiz/start" className="bg-white border-2 border-gray-100 hover:border-indigo-300 rounded-2xl p-4 text-center transition-colors">
            <div className="text-3xl mb-1">📊</div>
            <p className="font-bold text-gray-800 text-sm">ISI 量表</p>
            <p className="text-xs text-gray-400 mt-0.5">失眠嚴重度</p>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/sleep-quiz" className="flex-1 text-center border-2 border-gray-200 text-gray-700 font-bold py-3.5 rounded-2xl hover:border-purple-400 hover:text-purple-700 transition-colors">
            返回首頁
          </Link>
          <Link href="/sleep-quiz/psqi" className="flex-1 text-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-2xl transition-colors">
            重新測驗
          </Link>
        </div>
      </div>
    </div>
  )
}
