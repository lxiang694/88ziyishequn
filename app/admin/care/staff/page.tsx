'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EMPLOYMENT_LABELS, EMPLOYMENT_STATUS_LABELS, labelOf, chipClass } from '@/lib/care/staffing/labels'

interface Row {
  id: number; name: string; phone: string; status: string; completed_count: number
  employment_type: string | null; employment_status: string | null
  employment_missing: boolean; regions: string[]; verified_count: number
}

export default function CareStaffPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [missing, setMissing] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/admin/care/staff').then(r => r.json())
      .then(d => {
        if (d.success) { setRows(d.data.roster); setMissing(d.data.missing_employment) }
        else setError(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])

  const shown = filter ? rows.filter(r => r.employment_type === filter) : rows

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">👥 陪診員名冊</h1>
      <p className="text-gray-600 text-sm mb-4">
        這裡不顯示薪資、銀行帳號或人事附件。能力驗證只有具驗證權限的帳號能修改。
      </p>

      {missing.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4">
          <p className="font-bold text-amber-900 text-base mb-1">
            有 {missing.length} 位還沒有僱用條件
          </p>
          <p className="text-amber-900 text-[15px] leading-relaxed">
            系統<strong>不會猜</strong>他們是全職還是兼職。沒有僱用條件的人無法被派工或收到邀請，
            請逐一進入詳情頁建立。
          </p>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap mb-4">
        {[['', '全部'], ['full_time', '全職'], ['part_time', '兼職']].map(([k, label]) => (
          <button key={k || 'all'} onClick={() => setFilter(k)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${filter === k ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? (
          <div className="card p-8 text-center">
            <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error}</p>
            <p className="text-gray-700 text-[15px]">
              若提到資料表不存在，請先執行{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 rounded">migrations/care_staffing_schema.sql</code>
            </p>
          </div>
        )
        : shown.length === 0 ? <div className="card p-10 text-center text-gray-600">沒有符合的陪診員</div>
        : (
          <div className="space-y-2">
            {shown.map(r => (
              <Link key={r.id} href={`/admin/care/staff/${r.id}`}
                className="card p-4 block hover:border-green-400 border-2 border-transparent">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900 text-[15px]">{r.name}</span>
                  {r.employment_type ? (
                    <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.employment_status || '')}`}>
                      {labelOf(EMPLOYMENT_LABELS, r.employment_type)}・{labelOf(EMPLOYMENT_STATUS_LABELS, r.employment_status)}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-amber-100 text-amber-800">
                      未設定僱用條件
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                    {r.status === 'active' ? '啟用' : r.status === 'pending' ? '待審核' : '停用'}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">
                  {r.phone}｜已完成 {r.completed_count} 場｜已驗證能力 {r.verified_count} 項
                </p>
                <p className="text-gray-600 text-[13px] mt-0.5">
                  服務區域：{r.regions.length ? r.regions.join('、') : '尚未設定'}
                </p>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
