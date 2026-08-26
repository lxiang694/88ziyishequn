'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  LIFECYCLE_KIND_LABELS, LIFECYCLE_STATUS_LABELS, LIFECYCLE_REASON_LABELS, labelOf,
} from '@/lib/care/operations/labels'

interface Row {
  id: number; resource_kind: string; booking_id: number | null; status: string
  due_date: string | null; reason_code: string; note: string | null; created_at: string
}

const KINDS = Object.keys(LIFECYCLE_KIND_LABELS)
const REASONS = Object.keys(LIFECYCLE_REASON_LABELS)

export default function CareLifecyclePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState(KINDS[0])
  const [reason, setReason] = useState(REASONS[0])
  const [due, setDue] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/lifecycle').then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (url: string, b: Record<string, unknown>, msg: string) => {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setDue(''); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🗄 資料保留待辦</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <p className="font-bold text-blue-900 text-sm mb-1">這是待辦清單，不是刪除工具</p>
        <p className="text-sm text-blue-800">
          本輪**不刪除、不匿名化、不匯出**任何真實資料。真正的刪除要等法務、
          營運與備份策略確認後另做一輪。這一頁只記錄「哪些資料該在什麼時候被檢視」。
        </p>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-5 space-y-2">
        <p className="font-semibold text-gray-800 text-sm">新增待辦</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select value={kind} onChange={e => setKind(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            {KINDS.map(k => <option key={k} value={k}>{LIFECYCLE_KIND_LABELS[k]}</option>)}
          </select>
          <select value={reason} onChange={e => setReason(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            {REASONS.map(r => <option key={r} value={r}>{LIFECYCLE_REASON_LABELS[r]}</option>)}
          </select>
          <input type="date" value={due} onChange={e => setDue(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button
          onClick={() => post('/api/admin/care/lifecycle',
            { action: 'create', resource_kind: kind, reason_code: reason, due_date: due || undefined }, '已新增')}
          className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-semibold">
          新增
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {!loading && !error && (
        rows.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
            目前沒有待辦
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            {rows.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-4 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {labelOf(LIFECYCLE_KIND_LABELS, r.resource_kind)}
                    {r.booking_id && <span className="text-gray-500 font-normal">・服務 #{r.booking_id}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {labelOf(LIFECYCLE_REASON_LABELS, r.reason_code)}
                    {r.due_date && `・到期 ${r.due_date}`}
                  </p>
                </div>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-gray-100 rounded px-2 py-1">
                    {labelOf(LIFECYCLE_STATUS_LABELS, r.status)}
                  </span>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => post(`/api/admin/care/lifecycle/${r.id}`,
                        { action: 'mark_reviewed', status: 'reviewed' }, '已標記')}
                      className="text-xs border rounded px-2 py-1">標記已檢視</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
