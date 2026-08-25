'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  TIME_OFF_TYPE_LABELS, TIME_OFF_STATUS_LABELS, TIME_OFF_REASON_LABELS,
  labelOf, chipClass,
} from '@/lib/care/staffing/labels'

interface Row {
  id: number; companion_id: number; request_type: string
  start_date: string; end_date: string; reason_code: string; note: string | null
  status: string; review_note: string | null; created_at: string
}

const FILTERS = ['', 'submitted', 'approved', 'rejected', 'cancelled']

export default function CareTimeOffPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('submitted')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/time-off' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  const review = async (id: number, decision: 'approve' | 'reject') => {
    const res = await fetch('/api/admin/care/time-off', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'review', request_id: id, decision }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(decision === 'approve' ? '已核准' : '已拒絕'); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🗓️ 請假／暫停接案審核</h1>
      <p className="text-gray-600 text-sm mb-4">
        核准後該期間不能再派工。若期間內已有已指派的服務，系統會擋下核准，需先依既有流程取消或換人。
      </p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? TIME_OFF_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : rows.length === 0 ? <div className="card p-10 text-center text-gray-600">這個狀態目前沒有申請</div>
        : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.status)}`}>
                    {labelOf(TIME_OFF_STATUS_LABELS, r.status)}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-gray-100 text-gray-700">
                    {labelOf(TIME_OFF_TYPE_LABELS, r.request_type)}
                  </span>
                  <Link href={`/admin/care/staff/${r.companion_id}`}
                    className="text-green-700 font-semibold text-[15px] underline">
                    陪診員 #{r.companion_id}
                  </Link>
                </div>
                <p className="font-semibold text-gray-900 text-[15px]">{r.start_date} ～ {r.end_date}</p>
                <p className="text-gray-600 text-sm mt-0.5">
                  原因：{labelOf(TIME_OFF_REASON_LABELS, r.reason_code)}
                </p>
                {r.note && <p className="text-gray-700 text-[15px] mt-1">{r.note}</p>}

                {r.status === 'submitted' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => review(r.id, 'approve')} className="btn-primary">核准</button>
                    <button onClick={() => review(r.id, 'reject')} className="btn-secondary">拒絕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
