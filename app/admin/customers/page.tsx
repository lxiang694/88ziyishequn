'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const SEGMENTS = [
  { value: '', label: '全部' },
  { value: 'vip', label: 'VIP' },
  { value: 'repeat', label: '回頭客' },
  { value: 'new', label: '新客' },
  { value: 'dormant', label: '沉睡客' },
  { value: 'lost', label: '流失客' },
]

const SORTS = [
  { value: 'amount_desc', label: '累計金額 高→低' },
  { value: 'orders_desc', label: '消費筆數 多→少' },
  { value: 'recent_desc', label: '最近消費 新→舊' },
  { value: 'inactive_desc', label: '未回購天數 多→少' },
]

const SEGMENT_COLOR: Record<string, string> = {
  vip: 'bg-purple-100 text-purple-700',
  repeat: 'bg-green-100 text-green-700',
  new: 'bg-blue-100 text-blue-700',
  dormant: 'bg-orange-100 text-orange-700',
  lost: 'bg-gray-200 text-gray-600',
}

function formatMoney(n: number) {
  return `NT$${Number(n || 0).toLocaleString('zh-TW')}`
}

export default function CustomersPage() {
  const [summary, setSummary] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [sort, setSort] = useState('amount_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sort })
    if (search) params.set('search', search)
    if (segment) params.set('segment', segment)
    const res = await fetch('/api/admin/customers?' + params)
    if (res.status === 403) { setDenied(true); setLoading(false); return }
    const d = await res.json()
    if (d.success) {
      setSummary(d.data.summary)
      setCustomers(d.data.customers)
      setTotal(d.data.total)
    }
    setLoading(false)
  }, [search, segment, sort, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '5000', sort })
      if (search) params.set('search', search)
      if (segment) params.set('segment', segment)
      const res = await fetch('/api/admin/customers?' + params)
      const d = await res.json()
      if (!d.success) { toast.error(d.error || '匯出失敗'); return }
      const rows: any[] = d.data.customers
      if (rows.length === 0) { toast.error('沒有資料可匯出'); return }
      const header = ['姓名', '手機', 'LINE ID', '分層', '訂單筆數', '累計金額', '客單價', '首次消費', '最後消費', '距今天數', '平均回購天數']
      const lines = [header, ...rows.map(c => [
        c.customer_name, c.phone, c.line_id, c.segment_label, c.order_count, c.total_amount, c.avg_order_value,
        formatDate(c.first_order_at), formatDate(c.last_order_at), c.days_since_last_order, c.avg_repurchase_days ?? '',
      ])].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const blob = new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `復購分析_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      // 稽核：記錄此次客戶資料下載
      fetch('/api/admin/audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export_customers', detail: `下載復購/客戶名單 ${rows.length} 筆` }),
      }).catch(() => {})
      toast.success(`已匯出 ${rows.length} 筆客戶資料`)
    } catch {
      toast.error('匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  if (denied) {
    return (
      <div className="py-20 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <p className="text-gray-500">您沒有查看客戶分析的權限</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">復購分析</h1>
          <p className="text-gray-400 text-sm mt-0.5">以手機號彙總客戶消費紀錄（已排除已取消訂單）</p>
        </div>
        <button onClick={handleExport} disabled={exporting || loading}
          className="text-sm font-bold text-green-700 border-2 border-green-200 hover:bg-green-50 rounded-xl px-4 py-2 transition-colors disabled:opacity-40">
          {exporting ? '匯出中...' : '⬇ 匯出目前篩選結果'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
        {[
          { label: '客戶總數', value: summary?.total_customers ?? '—', icon: '👥' },
          { label: '複購率', value: summary ? `${summary.repurchase_rate}%` : '—', sub: summary ? `${summary.repeat_customers} 位複購` : '', icon: '🔁' },
          { label: '平均客單價', value: summary ? formatMoney(summary.avg_order_value) : '—', icon: '💰' },
          { label: '平均回購週期', value: summary?.avg_repurchase_days != null ? `${summary.avg_repurchase_days} 天` : '—', icon: '📅' },
          { label: 'LINE 覆蓋率', value: summary ? `${summary.line_coverage_rate}%` : '—', icon: '💬' },
          { label: '總營收', value: summary ? formatMoney(summary.total_revenue) : '—', icon: '📈' },
        ].map(c => (
          <div key={c.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-lg font-bold text-gray-800">{c.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
            {c.sub && <div className="text-xs text-green-600 mt-0.5">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="form-input flex-1" style={{ height: '44px' }} placeholder="搜尋姓名、手機、LINE ID..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <select className="form-input sm:w-40" style={{ height: '44px' }} value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-input sm:w-32" style={{ height: '44px' }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
            {[20, 50, 100, 200].map(n => <option key={n} value={n}>每頁 {n} 筆</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map(s => (
            <button key={s.value} onClick={() => { setSegment(s.value); setPage(1) }}
              className={'px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ' + (segment === s.value ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-lg">載入中...</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center"><div className="text-4xl mb-3">🧑‍🤝‍🧑</div><p className="text-gray-400 text-lg">此條件下沒有客戶</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['客戶', '分層', '訂單筆數', '累計金額', '客單價', '首次消費', '最後消費', '距今天數', '操作'].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-bold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.phone} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-800">{c.customer_name || '—'}</div>
                      <div className="text-gray-500 font-mono text-xs">{c.phone}</div>
                      {c.line_id ? (
                        <div className="text-xs text-green-600 mt-0.5">💬 {c.line_id}</div>
                      ) : (
                        <div className="text-xs text-gray-300 mt-0.5">未留 LINE</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={'text-xs font-bold px-2 py-1 rounded-full ' + (SEGMENT_COLOR[c.segment] || 'bg-gray-100 text-gray-600')}>{c.segment_label}</span>
                    </td>
                    <td className="px-3 py-3 font-bold text-gray-800">{c.order_count}</td>
                    <td className="px-3 py-3 font-bold text-green-700 whitespace-nowrap">{formatMoney(c.total_amount)}</td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatMoney(c.avg_order_value)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(c.first_order_at)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(c.last_order_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={c.days_since_last_order > 60 ? 'text-red-500 font-bold' : 'text-gray-600'}>{c.days_since_last_order} 天</span>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/orders?search=${encodeURIComponent(c.phone)}`}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-700 transition-colors whitespace-nowrap">
                        查看訂單
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > pageSize && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold disabled:opacity-40 hover:bg-gray-50">← 上一頁</button>
            <span className="text-sm text-gray-500">第 {page} / {Math.ceil(total / pageSize)} 頁・共 {total} 位客戶</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold disabled:opacity-40 hover:bg-gray-50">下一頁 →</button>
          </div>
        )}
      </div>
    </div>
  )
}
