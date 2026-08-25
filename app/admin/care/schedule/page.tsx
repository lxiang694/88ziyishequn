'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EMPLOYMENT_LABELS, WEEKDAY_LABELS, labelOf } from '@/lib/care/staffing/labels'

interface Row {
  id: number; name: string; status: string; employment_type: string | null
  available_weekdays: number[]
  approved_time_off: { start_date: string; end_date: string; request_type: string }[]
}

export default function CareSchedulePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/admin/care/schedule').then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const shown = filter ? rows.filter(r => r.employment_type === filter) : rows

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">📅 班表與可服務時段</h1>
      <p className="text-gray-600 text-sm mb-4">
        全職以公司安排為準；兼職的週期性時段由本人設定，這裡唯讀。
      </p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {[['', '全部'], ['full_time', '全職'], ['part_time', '兼職']].map(([k, label]) => (
          <button key={k || 'all'} onClick={() => setFilter(k)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${filter === k ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : shown.length === 0 ? (
          <div className="card p-10 text-center text-gray-600">
            <p className="text-lg font-semibold text-gray-800 mb-1">沒有符合的陪診員</p>
            <p className="text-[15px]">建立僱用條件後才會出現在這裡。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Link href={`/admin/care/staff/${r.id}`} className="font-bold text-green-700 text-[15px] underline">
                    {r.name}
                  </Link>
                  <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-gray-100 text-gray-700">
                    {labelOf(EMPLOYMENT_LABELS, r.employment_type)}
                  </span>
                </div>

                <p className="text-gray-600 text-[13px] mb-1">可服務星期</p>
                {r.available_weekdays.length === 0 ? (
                  <p className="text-gray-600 text-[15px]">
                    {r.employment_type === 'full_time' ? '依公司班表安排' : '尚未設定'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {r.available_weekdays.map(w => (
                      <span key={w} className="bg-green-50 text-green-800 rounded-lg px-2.5 py-1 text-[13px] font-semibold">
                        {WEEKDAY_LABELS[w]}
                      </span>
                    ))}
                  </div>
                )}

                {r.approved_time_off.length > 0 && (
                  <>
                    <p className="text-gray-600 text-[13px] mt-3 mb-1">已核准請假／暫停</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.approved_time_off.map((t, i) => (
                        <span key={i} className="bg-amber-50 text-amber-900 rounded-lg px-2.5 py-1 text-[13px] font-semibold">
                          {t.start_date} ～ {t.end_date}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
