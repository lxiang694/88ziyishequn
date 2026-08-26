'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { OPERATIONS_QUEUE_LABELS } from '@/lib/care/operations/labels'

type Queue = Record<string, number>

/** 每個佇列指向真正能處理它的那一頁；數字全部來自真實資料 */
const LINKS: Record<string, string> = {
  pending_intakes: '/admin/care/intakes',
  pending_dispatch: '/admin/care/dispatch',
  in_service: '/admin/care/service-control',
  pending_record_review: '/admin/care/records',
  pending_summary_publish: '/admin/care/summaries',
  open_incidents: '/admin/care/incidents',
  open_concerns: '/admin/care/feedback',
  open_quality_follow_ups: '/admin/care/quality',
  pending_settlement_lines: '/admin/care/settlements',
}

export default function CareOperationsPage() {
  const [q, setQ] = useState<Queue | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/care/operations').then(r => r.json())
      .then(d => { d.success ? setQ(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const total = q ? Object.values(q).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🗂 營運控制台</h1>
      <p className="text-sm text-gray-500 mb-5">
        今天需要有人處理的事。數字都是即時查出來的，沒有資料就是 0，不會顯示估算值。
      </p>

      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {q && total === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <p className="font-bold text-emerald-800 mb-1">目前沒有待處理事項</p>
          <p className="text-sm text-emerald-700">
            所有佇列都是空的。若這不符合預期，請確認 migration 是否已執行。
          </p>
        </div>
      )}

      {q && total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(q).map(([k, v]) => (
            <Link key={k} href={LINKS[k] || '/admin/care'}
              className={`block rounded-xl border p-4 transition-colors ${
                v > 0 ? 'bg-white border-amber-300 hover:border-amber-400' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-xs text-gray-500 mb-1">{OPERATIONS_QUEUE_LABELS[k] || k}</p>
              <p className={`text-2xl font-bold ${v > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{v}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
