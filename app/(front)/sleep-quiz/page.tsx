import type { Metadata } from 'next'
import Link from 'next/link'
import SocialShareButtons from '@/components/front/SocialShareButtons'

const SITE_URL = 'https://healthec.vercel.app'

export const metadata: Metadata = {
  title: '睡眠健康自測 | 2 分鐘了解你的睡眠狀況',
  description: '使用國際標準 ISI 量表（失眠嚴重度指數），2 分鐘評估您的睡眠狀況，獲得個人化改善建議與適合的保健品推薦。',
  alternates: { canonical: `${SITE_URL}/sleep-quiz` },
  openGraph: {
    title: '睡眠健康自測 | 健康優選',
    description: '2 分鐘了解你的睡眠狀況，獲得個人化改善建議',
    url: `${SITE_URL}/sleep-quiz`,
    type: 'website',
  },
}

export default function SleepQuizLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-800 px-4 py-1.5 rounded-full text-sm font-bold mb-5">
            🌙 國際標準量表 ISI
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
            您的睡眠到底<br className="sm:hidden" />怎麼樣？
          </h1>
          <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
            做個 <strong className="text-indigo-700">2 分鐘自測</strong>，了解您的失眠嚴重度，
            獲得專屬的改善方案與保健品建議
          </p>
        </div>

        {/* Pre-screening (3 questions) */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
            💡 先做這 3 個快速判斷
          </p>
          <div className="space-y-3 mb-4">
            {[
              { q: '您能不能自然醒？', sub: '不靠鬧鐘硬拉，也不靠咖啡因吊命' },
              { q: '您白天會不會在開會、開車、聽演講時無法控制地打瞌睡？', sub: '' },
              { q: '您的情緒是否穩定？', sub: '會不會因為小事暴怒，或者莫名地低落？' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-gray-800 font-semibold text-sm leading-snug">{item.q}</p>
                  {item.sub && <p className="text-gray-400 text-xs mt-0.5">{item.sub}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-800 leading-relaxed">
            如果三個答案都是「<strong>是</strong>」——哪怕您昨晚只睡了 5 小時，您的睡眠就是合格的。
            如果有任何一個答案是「<strong>否</strong>」，下面的測驗就能幫您看清楚問題。
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-base font-bold text-gray-700 mb-4">完成測驗後，您會得到：</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📊', title: '失眠嚴重度分數', desc: '0-28 分數區間 + 顏色分級' },
              { icon: '🎯', title: '專屬改善建議', desc: '從 6 大策略中挑選適合您的' },
              { icon: '💊', title: '推薦營養素', desc: '依證據等級篩選' },
              { icon: '📚', title: '深入閱讀', desc: '相關健康知識文章' },
            ].map(b => (
              <div key={b.title} className="flex gap-3 items-start p-3 bg-indigo-50/50 rounded-xl">
                <span className="text-2xl flex-shrink-0">{b.icon}</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{b.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* About ISI */}
        <details className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 group">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="font-bold text-gray-700 text-sm">關於 ISI 量表</span>
            <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 text-sm text-gray-600 leading-relaxed space-y-2">
            <p>
              ISI（Insomnia Severity Index，失眠嚴重度指數）由 Morin 教授於 1993 年開發、2001 年修訂，
              是<strong>國際上失眠研究和 CBT-I（認知行為療法）療效評估的標準工具</strong>。
            </p>
            <p>
              共 7 題，根據過去兩週的情況選擇最符合的選項。完整 CBT-I 療程平均能讓 ISI 下降 6-9 分。
            </p>
            <p className="text-gray-400 text-xs">
              本工具僅作健康參考，不替代醫療診斷。
            </p>
          </div>
        </details>

        {/* CTA */}
        <Link
          href="/sleep-quiz/start"
          className="block w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-lg py-4 rounded-2xl text-center shadow-lg shadow-indigo-200 transition-all hover:scale-[1.01]"
        >
          開始 2 分鐘測驗（ISI）→
        </Link>

        {/* Other tools */}
        <div className="mt-6">
          <p className="text-center text-xs text-gray-400 mb-3 tracking-wide">— 進階工具 —</p>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/sleep-quiz/psqi"
              className="text-center p-3 bg-white rounded-2xl border border-purple-100 hover:border-purple-300 transition-colors">
              <div className="text-2xl mb-1">🌙</div>
              <p className="text-xs font-bold text-gray-700">PSQI</p>
              <p className="text-[10px] text-gray-400 mt-0.5">完整版 19 題</p>
            </Link>
            <Link href="/sleep-quiz/ess"
              className="text-center p-3 bg-white rounded-2xl border border-cyan-100 hover:border-cyan-300 transition-colors">
              <div className="text-2xl mb-1">😴</div>
              <p className="text-xs font-bold text-gray-700">ESS</p>
              <p className="text-[10px] text-gray-400 mt-0.5">嗜睡 / OSA 篩查</p>
            </Link>
            <Link href="/sleep-tracker"
              className="text-center p-3 bg-white rounded-2xl border border-emerald-100 hover:border-emerald-300 transition-colors">
              <div className="text-2xl mb-1">📅</div>
              <p className="text-xs font-bold text-gray-700">21 天打卡</p>
              <p className="text-[10px] text-gray-400 mt-0.5">習慣養成</p>
            </Link>
          </div>
        </div>

        {/* Social share — invite friends */}
        <SocialShareButtons
          url={`${SITE_URL}/sleep-quiz`}
          title="2 分鐘測試你的失眠程度（國際 ISI 量表）"
          heading="覺得家人朋友也需要？"
          subtext="一起重視睡眠品質"
          theme="indigo"
        />

        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          所有測驗結果僅供參考，不替代醫療診斷<br />
          如有嚴重失眠困擾，建議諮詢睡眠專科醫師
        </p>
      </div>
    </div>
  )
}
