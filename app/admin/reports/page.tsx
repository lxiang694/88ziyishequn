'use client'
import { useState, useEffect, useCallback } from 'react'
import { formatPrice } from '@/lib/utils'

const DATE_RANGES = [
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: '3days', label: '近3天' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自訂' },
]

const STATUS_COLORS: Record<string, string> = {
  '待確認': 'bg-yellow-100 text-yellow-800',
  '已確認': 'bg-blue-100 text-blue-800',
  '備貨中': 'bg-purple-100 text-purple-800',
  '已出貨': 'bg-indigo-100 text-indigo-800',
  '已到店': 'bg-green-100 text-green-800',
  '已取消': 'bg-red-100 text-red-800',
}

export default function ReportsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('month')
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
      const res = await fetch('/api/admin/reports?' + params)
      const d = await res.json()
      if (d.success) setData(d.data)
      else if (res.status === 403) setData(null)
    } catch {}
    setLoading(false)
  }, [dateRange, startDate, endDate])

  useEffect(() => {
    if (dateRange !== 'custom') fetchData()
  }, [dateRange, fetchData])

  const totalOrders = data?.summary?.total_orders ?? 0
  const totalItems = data?.summary?.total_items ?? 0
  const totalRevenue = data?.summary?.total_revenue ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">銷售報表</h1>
        <p className="text-[13px] text-gray-600">※ 銷售總額不含已取消訂單</p>
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
            <input type="date" className="form-input w-auto" style={{height:'44px'}} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-500 font-medium">至</span>
            <input type="date" className="form-input w-auto" style={{height:'44px'}} value={endDate} onChange={e => setEndDate(e.target.value)} />
            <button onClick={fetchData} disabled={!startDate || !endDate} className="btn-primary py-2 px-5 text-base disabled:opacity-40">查詢</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-600 text-lg">載入中...</div>
      ) : !data ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-500">您沒有查看報表的權限</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '📦', label: '訂單數', value: `${totalOrders} 筆`, color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { icon: '🛍️', label: '商品件數', value: `${totalItems} 件`, color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { icon: '💰', label: '銷售總額', value: formatPrice(totalRevenue), color: 'bg-green-50 text-green-700 border-green-100' },
            ].map(c => (
              <div key={c.label} className={`card p-5 text-center border ${c.color}`}>
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-sm mt-1 opacity-80">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Status stats */}
          {data.status_stats?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 text-lg mb-4">訂單狀態統計</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.status_stats.map((s: any) => (
                  <div key={s.order_status} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                    <span className={`status-badge ${STATUS_COLORS[s.order_status] || 'bg-gray-100 text-gray-600'}`}>{s.order_status}</span>
                    <span className="text-2xl font-bold text-gray-800">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product stats */}
          {data.product_stats?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 text-lg mb-4">商品銷量排行</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['#', '商品名稱', '銷售件數', '銷售金額'].map(h => <th key={h} className="text-left px-4 py-3 font-bold text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.product_stats.map((p: any, i: number) => (
                      <tr key={p.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-600 text-base">#{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{p.product_name}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-lg text-sm">{p.total_qty} 件</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatPrice(p.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variant stats */}
          {data.variant_stats?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 text-lg mb-4">規格銷量排行</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['#', '商品', '規格', 'SKU', '件數', '金額'].map(h => <th key={h} className="text-left px-4 py-3 font-bold text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.variant_stats.map((v: any, i: number) => (
                      <tr key={v.variant_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-600">#{i + 1}</td>
                        <td className="px-4 py-3 text-gray-700">{v.product_name}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{v.variant_name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-[13px]">{v.sku_code || '—'}</td>
                        <td className="px-4 py-3 font-bold text-gray-700">{v.total_qty}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{formatPrice(v.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Category stats */}
          {data.category_stats?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 text-lg">健康分類銷量統計</h2>
                <span className="text-[13px] text-gray-600">※ 一商品可同時計入多個分類</span>
              </div>
              <div className="space-y-3">
                {data.category_stats.map((c: any) => {
                  const maxRev = data.category_stats[0]?.total_revenue || 1
                  const pct = Math.round((c.total_revenue / maxRev) * 100)
                  return (
                    <div key={c.category_name}>
                      <div className="flex justify-between items-center text-sm mb-1.5">
                        <span className="font-bold text-gray-700">{c.category_name}</span>
                        <span className="text-gray-500">{c.total_qty} 件 · <span className="text-green-700 font-bold">{formatPrice(c.total_revenue)}</span></span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-3">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-full h-3 transition-all duration-500" style={{ width: pct + '%' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {totalOrders === 0 && (
            <div className="card p-12 text-center text-gray-600">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-lg">此時間範圍內沒有訂單資料</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
