'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { QUOTE_STATUS_LABELS, labelFor, statusChipClass } from '@/lib/care/labels'

interface Row {
  id: number; care_case_id: number; version: number; status: string
  service_name_snapshot: string; total_estimate: number; valid_until: string; created_at: string
}

const FILTERS = ['', 'draft', 'sent', 'confirmed', 'expired', 'cancelled']

export default function CareQuotesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('status') || ''
    if (FILTERS.includes(q)) setStatus(q)
  }, [])

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/quotes' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🧾 報價管理</h1>
      <p className="text-gray-600 text-sm mb-4">報價為版本化快照；已確認或已過期的報價不可修改</p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? QUOTE_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : rows.length === 0 ? <div className="card p-10 text-center text-gray-600">這個狀態目前沒有報價</div>
        : (
          <div className="space-y-2">
            {rows.map(r => (
              <Link key={r.id} href={`/admin/care/quotes/${r.id}`} className="card p-4 block hover:border-green-400 border-2 border-transparent">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${statusChipClass('quote', r.status)}`}>
                    {labelFor(QUOTE_STATUS_LABELS, r.status)}
                  </span>
                  <span className="text-gray-600 text-[13px]">第 {r.version} 版・有效至 {r.valid_until}</span>
                </div>
                <p className="font-semibold text-gray-900 text-[15px]">
                  {r.service_name_snapshot}・預估 {formatPrice(r.total_estimate)}
                </p>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
