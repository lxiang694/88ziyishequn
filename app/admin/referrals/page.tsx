'use client'
import { useState, useEffect, useMemo } from 'react'

export default function ReferralsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/admin/referrals')
      .then(r => {
        if (r.status === 403) { setDenied(true); return null }
        return r.json()
      })
      .then(d => { if (d?.success) setData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const summary = data?.summary
  const leaderboard: any[] = data?.leaderboard ?? []

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return leaderboard
    return leaderboard.filter(m =>
      (m.name || '').toLowerCase().includes(k) ||
      (m.phone || '').includes(k) ||
      (m.referral_code || '').toLowerCase().includes(k)
    )
  }, [leaderboard, keyword])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">邀請裂變成效</h1>
        <p className="text-xs text-gray-400">※ LINE 好友邀請積分</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-lg">載入中...</div>
      ) : denied ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-500">您沒有查看此資料的權限</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🤝', label: '成功邀請總數', value: summary?.totalReferrals ?? 0, color: 'bg-green-50 text-green-700 border-green-100' },
              { icon: '🎁', label: '累計發出積分', value: summary?.totalPoints ?? 0, color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { icon: '🆕', label: '今日邀請', value: summary?.today ?? 0, color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { icon: '📅', label: '本月邀請', value: summary?.month ?? 0, color: 'bg-orange-50 text-orange-700 border-orange-100' },
            ].map(c => (
              <div key={c.label} className={`card p-5 text-center border ${c.color}`}>
                <div className="text-3xl mb-2">{c.icon}</div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs mt-1 opacity-80">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Leaderboard */}
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-800">邀請排行榜</h2>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="搜尋姓名 / 手機 / 邀請碼"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:border-green-400"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">尚無邀請紀錄</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">會員</th>
                      <th className="py-2 pr-3 font-medium">邀請碼</th>
                      <th className="py-2 pr-3 font-medium text-right">成功邀請</th>
                      <th className="py-2 pr-3 font-medium text-right">邀請積分</th>
                      <th className="py-2 font-medium text-right">總積分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => (
                      <tr key={m.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 pr-3 text-gray-400">{i + 1}</td>
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-gray-800">{m.name}</p>
                          {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                        </td>
                        <td className="py-3 pr-3 font-mono text-gray-600">{m.referral_code || '—'}</td>
                        <td className="py-3 pr-3 text-right font-bold text-green-700">{m.invited}</td>
                        <td className="py-3 pr-3 text-right text-gray-600">{m.points_from_referral}</td>
                        <td className="py-3 text-right text-gray-600">{m.total_points}</td>
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
