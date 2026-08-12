'use client'
import { useState, useEffect, useMemo } from 'react'
import { formatDateTime } from '@/lib/utils'

export default function MembersPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/admin/members')
      .then(r => {
        if (r.status === 403) { setDenied(true); return null }
        return r.json()
      })
      .then(d => { if (d?.success) setData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const members: any[] = data?.members ?? []
  const summary = data?.summary

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return members
    return members.filter(m =>
      (m.name || '').toLowerCase().includes(k) ||
      (m.phone || '').includes(k) ||
      (m.email || '').toLowerCase().includes(k)
    )
  }, [members, keyword])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">會員管理</h1>
        <p className="text-[13px] text-gray-600">※ 註冊會員資料</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-600 text-lg">載入中...</div>
      ) : denied ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-500">您沒有查看會員資料的權限</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '👥', label: '會員總數', value: summary?.total ?? 0, color: 'bg-green-50 text-green-700 border-green-100' },
              { icon: '🆕', label: '今日新增', value: summary?.new_today ?? 0, color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { icon: '📅', label: '本月新增', value: summary?.new_month ?? 0, color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { icon: '✅', label: '已驗證 Email', value: summary?.verified ?? 0, color: 'bg-orange-50 text-orange-700 border-orange-100' },
            ].map(c => (
              <div key={c.label} className={`card p-5 text-center border ${c.color}`}>
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-sm mt-1 opacity-80">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="card p-4">
            <input className="form-input" placeholder="搜尋姓名、手機或 Email..."
              value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>

          {/* Member table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
              共 <span className="font-bold text-gray-800">{filtered.length}</span> 筆
            </div>
            {filtered.length === 0 ? (
              <p className="text-gray-600 text-center py-12">{keyword ? '查無符合的會員' : '暫無註冊會員'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['姓名', '手機', 'Email', '訂單數', '註冊時間', '最後登入', 'Email 驗證'].map(h =>
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{m.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono whitespace-nowrap">{m.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 break-all">{m.email || '—'}</td>
                        <td className="px-4 py-3">
                          {m.order_count > 0
                            ? <span className="bg-green-50 text-green-700 font-bold px-2 py-1 rounded-lg">{m.order_count}</span>
                            : <span className="text-gray-600">0</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.last_sign_in_at ? formatDateTime(m.last_sign_in_at) : '從未登入'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[13px] font-semibold px-2 py-1 rounded-full ${m.email_confirmed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {m.email_confirmed ? '已驗證' : '未驗證'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
