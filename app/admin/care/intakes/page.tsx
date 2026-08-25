'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { INTAKE_STATUS_LABELS, SCENARIO_LABELS, labelFor, statusChipClass } from '@/lib/care/labels'

interface Row {
  id: number; service_scenario: string; mobility_support_level: string
  transport_support_requested: boolean; hospital_name: string; county: string
  scheduled_service_date: string; contact_name: string; status: string; created_at: string
}

const FILTERS = ['', 'submitted', 'in_review', 'needs_more_information', 'declined', 'converted_to_case']

export default function CareIntakesPage() {
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
    fetch('/api/admin/care/intakes' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">📝 需求初評</h1>
        <p className="text-gray-600 text-sm mt-0.5">
          清單不顯示聯絡電話與補充需求；需要時請進入詳情頁查看
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? INTAKE_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-600">載入中…</div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error}</p>
          <p className="text-gray-700 text-[15px]">
            若資料表不存在，請先執行{' '}
            <code className="px-1.5 py-0.5 bg-gray-100 rounded">migrations/care_operations_schema.sql</code>
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-600">
          <p className="text-lg font-semibold text-gray-800">這個狀態目前沒有資料</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} href={`/admin/care/intakes/${r.id}`} className="card p-4 block hover:border-green-400 border-2 border-transparent">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${statusChipClass('intake', r.status)}`}>
                  {labelFor(INTAKE_STATUS_LABELS, r.status)}
                </span>
                <span className="text-gray-600 text-[13px]">{r.created_at?.slice(0, 10)} 送出</span>
              </div>
              <p className="font-semibold text-gray-900 text-[15px]">
                {r.scheduled_service_date}・{r.county} {r.hospital_name}
              </p>
              <p className="text-gray-600 text-sm mt-0.5">
                {labelFor(SCENARIO_LABELS, r.service_scenario)}
                ｜聯絡人：{r.contact_name}
                {r.transport_support_requested && '｜需交通協助'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
