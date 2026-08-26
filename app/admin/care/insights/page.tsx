'use client'
import { useEffect, useState } from 'react'

interface Score { value: number | null; suppressed: boolean; sample: number }
interface Insights {
  counts: Record<string, number>
  feedback_completion_rate: number | null
  scores: { reassurance: Score; communication: Score; process_support: Score }
  min_sample: number
  has_data: boolean
}

const COUNT_LABELS: Record<string, string> = {
  intakes_total: '需求初評總數',
  cases_total: '案件總數',
  quotes_confirmed: '已確認報價',
  bookings_total: '服務總數',
  bookings_completed: '已完成服務',
  proposals_accepted: '兼職接受邀請',
  proposals_declined: '兼職婉拒邀請',
  summaries_published: '已發布小結',
  feedback_requests: '回饋邀請',
  feedback_submitted: '已填回饋',
}

export default function CareInsightsPage() {
  const [d, setD] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/care/insights').then(r => r.json())
      .then(r => { r.success ? setD(r.data) : setError(r.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const scoreCard = (label: string, s: Score) => (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {s.suppressed ? (
        <>
          <p className="text-lg font-semibold text-gray-400">樣本不足</p>
          <p className="text-xs text-gray-500 mt-1">
            目前 {s.sample} 份，未達 {d?.min_sample} 份。數字太少會反推到個別家庭，因此不顯示。
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900">{s.value} <span className="text-base text-gray-400">/ 5</span></p>
          <p className="text-xs text-gray-500 mt-1">{s.sample} 份回饋</p>
        </>
      )}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">📊 營運指標</h1>
      <p className="text-sm text-gray-500 mb-5">
        全部從真實資料即時計算。沒有預估值、沒有示範資料，樣本不足時寧可不顯示。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {d && !d.has_data && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="font-bold text-gray-700 mb-1">還沒有資料</p>
          <p className="text-sm text-gray-500">有服務進來之後，這裡才會有數字。</p>
        </div>
      )}

      {d && d.has_data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {Object.entries(d.counts).map(([k, v]) => (
              <div key={k} className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500 mb-1">{COUNT_LABELS[k] || k}</p>
                <p className="text-2xl font-bold text-gray-900">{v}</p>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-gray-800 mb-2">家屬回饋（去識別化）</h2>
          <div className="bg-white rounded-xl border p-4 mb-3">
            <p className="text-xs text-gray-500 mb-1">回饋完成率</p>
            <p className="text-2xl font-bold text-gray-900">
              {d.feedback_completion_rate === null ? '—' : `${d.feedback_completion_rate}%`}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scoreCard('整體安心感', d.scores.reassurance)}
            {scoreCard('溝通清楚度', d.scores.communication)}
            {scoreCard('流程協助', d.scores.process_support)}
          </div>

          <p className="text-xs text-gray-500 mt-5 bg-gray-50 rounded-lg p-3">
            這裡刻意沒有個別陪診員的評分或排行。用服務對象的評分去排人員名次，
            會讓接到困難個案的人分數變差——那不是品質問題，是個案難度問題。
          </p>
        </>
      )}
    </div>
  )
}
