'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  RECORD_STATUS_LABELS, RETURN_REASON_LABELS, FOLLOW_UP_REASON_LABELS,
  labelOf, chipClass,
} from '@/lib/care/fulfilment/labels'

interface Row {
  id: number; booking_id: number; companion_id: number; revision: number; status: string
  met_completed: boolean; checkin_completed: boolean; process_handover_completed: boolean
  return_arrangement_completed: boolean; family_contact_completed: boolean
  family_follow_up_needed: boolean; follow_up_reason_code: string | null
  objective_summary: string | null; submitted_at: string | null; updated_at: string
}

const FILTERS = ['', 'submitted', 'returned_for_revision', 'reviewed', 'draft']
const STEPS: { k: keyof Row; label: string }[] = [
  { k: 'met_completed', label: '已會合' },
  { k: 'checkin_completed', label: '已報到' },
  { k: 'process_handover_completed', label: '流程銜接' },
  { k: 'return_arrangement_completed', label: '返程安排' },
  { k: 'family_contact_completed', label: '已聯繫家屬' },
]

export default function CareRecordsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('submitted')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [returning, setReturning] = useState<number | null>(null)
  const [reason, setReason] = useState('incomplete_process_steps')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('status')
    if (q && FILTERS.includes(q)) setStatus(q)
  }, [])

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/records' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  const act = async (id: number, body: Record<string, unknown>, msg: string) => {
    const res = await fetch(`/api/admin/care/records/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setReturning(null); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">📋 服務紀錄審核</h1>
      <p className="text-gray-600 text-sm mb-4">
        陪診員填寫的內部客觀紀錄。這不是病歷；核可後才可據以撰寫家屬小結。
      </p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? RECORD_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : rows.length === 0 ? <div className="card p-10 text-center text-gray-600">這個狀態目前沒有服務紀錄</div>
        : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.status)}`}>
                    {labelOf(RECORD_STATUS_LABELS, r.status)}
                  </span>
                  <Link href={`/admin/care/services/${r.booking_id}`}
                    className="text-green-700 font-semibold text-[15px] underline">服務 #{r.booking_id}</Link>
                  <span className="text-gray-600 text-[13px]">第 {r.revision} 版</span>
                  {r.submitted_at && <span className="text-gray-600 text-[13px]">{r.submitted_at.slice(0, 16).replace('T', ' ')} 送審</span>}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {STEPS.map(s => (
                    <span key={s.k as string}
                      className={`text-[13px] px-2 py-0.5 rounded-md ${r[s.k] ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      {r[s.k] ? '✓' : '—'} {s.label}
                    </span>
                  ))}
                </div>

                {r.family_follow_up_needed && (
                  <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[15px] mb-2">
                    需家屬處理：{labelOf(FOLLOW_UP_REASON_LABELS, r.follow_up_reason_code)}
                  </p>
                )}

                {r.objective_summary && (
                  <p className="text-gray-800 text-[15px] leading-relaxed bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {r.objective_summary}
                  </p>
                )}

                {r.status === 'submitted' && (
                  returning === r.id ? (
                    <div className="mt-3 space-y-2">
                      <label className="form-label" htmlFor={`rr-${r.id}`}>退回原因</label>
                      <select id={`rr-${r.id}`} className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
                        {Object.entries(RETURN_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => act(r.id, { action: 'return_for_revision', reason_code: reason }, '已退回補正')}
                          className="btn-danger">確定退回</button>
                        <button onClick={() => setReturning(null)} className="btn-secondary">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => act(r.id, { action: 'review' }, '已核可')} className="btn-primary">核可</button>
                      <button onClick={() => setReturning(r.id)} className="btn-secondary">退回補正</button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
