'use client'
import { useState, useEffect, useCallback } from 'react'

const DATE_RANGES = [
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: '7days', label: '近7天' },
  { value: '30days', label: '近30天' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自訂' },
]

export default function TrafficPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [dateRange, setDateRange] = useState('7days')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ dateRange })
    if (dateRange === 'custom' && startDate && endDate) {
      params.set('startDate', startDate)
      params.set('endDate', endDate)
    }
    try {
      const res = await fetch('/api/admin/traffic?' + params)
      if (res.status === 403) { setDenied(true); setData(null); setLoading(false); return }
      const d = await res.json()
      if (d.success) { setData(d.data); setDenied(false) }
    } catch {}
    setLoading(false)
  }, [dateRange, startDate, endDate])

  useEffect(() => {
    if (dateRange !== 'custom') fetchData()
  }, [dateRange, fetchData])

  const pv = data?.summary?.pv ?? 0
  const uv = data?.summary?.uv ?? 0
  const memberViews = data?.summary?.member_views ?? 0
  const avgPerVisitor = uv > 0 ? (pv / uv).toFixed(1) : '0'
  const trend: any[] = data?.trend ?? []
  const maxPv = Math.max(1, ...trend.map(t => t.pv))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">流量監控</h1>
        <p className="text-xs text-gray-400">※ 統計不含後台頁面</p>
      </div>

      {/* Date filter */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {DATE_RANGES.map(d => (
            <button key={d.value} onClick={() => setDateRange(d.value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors
                ${dateRange === d.value ? 'bg-green-700 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d.label}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div className="flex flex-wrap gap-3 mt-3 items-center">
            <input type="date" className="form-input w-auto" style={{ height: '44px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-500 font-medium">至</span>
            <input type="date" className="form-input w-auto" style={{ height: '44px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
            <button onClick={fetchData} disabled={!startDate || !endDate} className="btn-primary py-2 px-5 text-base disabled:opacity-40">查詢</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-lg">載入中...</div>
      ) : denied ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-500">您沒有查看流量的權限</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '👁️', label: '瀏覽量 PV', value: pv.toLocaleString(), color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { icon: '🧑‍🤝‍🧑', label: '訪客數 UV', value: uv.toLocaleString(), color: 'bg-green-50 text-green-700 border-green-100' },
              { icon: '📄', label: '人均瀏覽', value: avgPerVisitor + ' 頁', color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { icon: '⭐', label: '會員瀏覽', value: memberViews.toLocaleString(), color: 'bg-orange-50 text-orange-700 border-orange-100' },
            ].map(c => (
              <div key={c.label} className={`card p-5 text-center border ${c.color}`}>
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-sm mt-1 opacity-80">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-800 text-lg mb-4">每日流量趨勢</h2>
            {trend.length === 0 || pv === 0 ? (
              <p className="text-gray-400 text-center py-12">此時間範圍內沒有流量資料</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-2 min-w-full" style={{ height: '220px' }}>
                  {trend.map(t => (
                    <div key={t.date} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-[28px]" title={`${t.date}　PV ${t.pv}　UV ${t.uv}`}>
                      <span className="text-[11px] font-bold text-blue-700">{t.pv || ''}</span>
                      <div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md transition-all"
                        style={{ height: `${Math.round((t.pv / maxPv) * 160)}px`, minHeight: t.pv > 0 ? '3px' : '0' }} />
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{t.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />瀏覽量 PV</span>
                </div>
              </div>
            )}
          </div>

          {/* Top paths */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-800 text-lg mb-4">熱門頁面 Top 20</h2>
            {(!data?.top_paths || data.top_paths.length === 0) ? (
              <p className="text-gray-400 text-center py-8">暫無資料</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['#', '頁面路徑', '瀏覽量 PV', '訪客數 UV'].map(h => <th key={h} className="text-left px-4 py-3 font-bold text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.top_paths.map((p: any, i: number) => (
                      <tr key={p.path} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-400">#{i + 1}</td>
                        <td className="px-4 py-3 font-mono text-gray-700 break-all">{p.path}</td>
                        <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-lg">{p.pv}</span></td>
                        <td className="px-4 py-3 font-semibold text-gray-600">{p.uv}</td>
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
