'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const SEGMENTS = [
  { value: '', label: '全部' },
  { value: 'due', label: '⏰ 待喚醒' },
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
  { value: 'due_desc', label: '最該回購優先' },
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

// 堆疊長條圖（近30天每日 / 近6月每月）
function StackedBars({ items, aKey, bKey, aColor, bColor, aLabel, bLabel, firstLabel, lastLabel }: any) {
  const max = Math.max(1, ...items.map((d: any) => (d[aKey] || 0) + (d[bKey] || 0)))
  const n = items.length
  const bw = 100 / n
  return (
    <div>
      <div className="flex gap-4 text-[13px] text-gray-500 mb-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: aColor }} />{aLabel}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: bColor }} />{bLabel}</span>
      </div>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full" style={{ height: 150 }}>
        {items.map((d: any, i: number) => {
          const a = d[aKey] || 0, b = d[bKey] || 0
          const hA = (a / max) * 56, hB = (b / max) * 56
          const x = i * bw + bw * 0.15, w = bw * 0.7
          return (
            <g key={i}>
              <rect x={x} y={60 - hA} width={w} height={hA} fill={aColor} />
              <rect x={x} y={60 - hA - hB} width={w} height={hB} fill={bColor} />
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-[13px] text-gray-600 mt-1"><span>{firstLabel}</span><span>{lastLabel}</span></div>
    </div>
  )
}

// 折線圖（近8週沉睡/流失）
function LineChart({ items, series, firstLabel, lastLabel }: any) {
  const vals = items.flatMap((d: any) => series.map((s: any) => d[s.key] || 0))
  const max = Math.max(1, ...vals)
  const n = items.length
  const px = (i: number) => n <= 1 ? 50 : (i / (n - 1)) * 100
  const py = (v: number) => 56 - (v / max) * 50
  const last = items[items.length - 1] || {}
  return (
    <div>
      <div className="flex gap-4 text-[13px] text-gray-500 mb-2">
        {series.map((s: any) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
            {s.label} <span className="font-bold" style={{ color: s.color }}>{last[s.key] ?? 0}</span>
          </span>
        ))}
      </div>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full" style={{ height: 150 }}>
        {series.map((s: any) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke"
            points={items.map((d: any, i: number) => `${px(i)},${py(d[s.key] || 0)}`).join(' ')} />
        ))}
      </svg>
      <div className="flex justify-between text-[13px] text-gray-600 mt-1"><span>{firstLabel}</span><span>{lastLabel}</span></div>
    </div>
  )
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
  const [trends, setTrends] = useState<any>(null)
  const [products, setProducts] = useState<any>(null)

  useEffect(() => {
    fetch('/api/admin/customers/trends').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.success) setTrends(d.data)
    }).catch(() => {})
    fetch('/api/admin/customers/products').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.success) setProducts(d.data)
    }).catch(() => {})
  }, [])

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

  const showDueList = () => { setSegment('due'); setSort('due_desc'); setPage(1) }

  const copyContact = (c: any) => {
    const text = `${c.customer_name || ''} ${c.phone}${c.line_id ? ` LINE:${c.line_id}` : ''}`.trim()
    navigator.clipboard.writeText(text)
      .then(() => toast.success('已複製聯絡資訊'))
      .catch(() => toast.error('複製失敗'))
  }

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
      const header = ['姓名', '手機', 'LINE ID', '分層', '訂單筆數', '累計金額', '客單價', '首次消費', '最後消費', '距今天數', '平均回購天數', '預估回購日', '逾期天數']
      const lines = [header, ...rows.map(c => [
        c.customer_name, c.phone, c.line_id, c.segment_label, c.order_count, c.total_amount, c.avg_order_value,
        formatDate(c.first_order_at), formatDate(c.last_order_at), c.days_since_last_order, c.avg_repurchase_days ?? '',
        c.expected_next_at ? formatDate(c.expected_next_at) : '', c.overdue_days != null && c.overdue_days > 0 ? c.overdue_days : '',
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
          <p className="text-gray-600 text-sm mt-0.5">以手機號彙總客戶消費紀錄（已排除已取消訂單）</p>
        </div>
        <button onClick={handleExport} disabled={exporting || loading}
          className="text-sm font-bold text-green-700 border-2 border-green-200 hover:bg-green-50 rounded-xl px-4 py-2 transition-colors disabled:opacity-40">
          {exporting ? '匯出中...' : '⬇ 匯出目前篩選結果'}
        </button>
      </div>

      {/* 今日營運概況 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-green-600 rounded-full" />
        <h2 className="text-sm font-bold text-gray-700">今日營運概況</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* 今日復購人數 */}
        <div className="card p-4 border-2 border-green-100 bg-green-50/40">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500 font-semibold">今日復購人數</span>
            <span className="text-lg">🔁</span>
          </div>
          <div className="text-3xl font-extrabold text-green-700 mt-1">{summary?.repurchase_today ?? '—'}</div>
          <div className="text-[13px] text-gray-600 mt-0.5">
            {summary?.reactivated_today ? `含喚醒沉睡客 ${summary.reactivated_today} 位` : '今日回頭下單的老客戶'}
          </div>
        </div>
        {/* 老客戶營收占比 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500 font-semibold">老客戶營收占比</span>
            <span className="text-lg">💎</span>
          </div>
          <div className="text-3xl font-extrabold text-gray-800 mt-1">{summary ? `${summary.returning_revenue_share}%` : '—'}</div>
          <div className="text-[13px] text-gray-600 mt-0.5">回購 ≥2 次客戶貢獻的營收比重</div>
        </div>
        {/* 沉睡客戶數 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500 font-semibold">沉睡客戶</span>
            <span className="text-lg">😴</span>
          </div>
          <div className="text-3xl font-extrabold text-orange-600 mt-1">{summary?.dormant_count ?? '—'}<span className="text-base font-bold text-gray-600"> 位</span></div>
          <div className="text-[13px] mt-0.5">
            {summary == null ? <span className="text-gray-600">—</span>
              : summary.dormant_change_today > 0 ? <span className="text-red-500 font-bold">今日 ▲ 新增 {summary.dormant_change_today} 位</span>
              : summary.dormant_change_today < 0 ? <span className="text-green-600 font-bold">今日 ▼ 減少 {Math.abs(summary.dormant_change_today)} 位</span>
              : <span className="text-gray-600">今日持平</span>}
          </div>
        </div>
        {/* 流失客戶數 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500 font-semibold">流失客戶</span>
            <span className="text-lg">💤</span>
          </div>
          <div className="text-3xl font-extrabold text-gray-500 mt-1">{summary?.lost_count ?? '—'}<span className="text-base font-bold text-gray-600"> 位</span></div>
          <div className="text-[13px] text-gray-600 mt-0.5">超過 180 天未回購</div>
        </div>
      </div>

      {/* 整體指標 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gray-300 rounded-full" />
        <h2 className="text-sm font-bold text-gray-700">整體指標</h2>
      </div>
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
            <div className="text-[13px] text-gray-600 mt-0.5">{c.label}</div>
            {c.sub && <div className="text-[13px] text-green-600 mt-0.5">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* 趨勢分析 */}
      {trends && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-gray-300 rounded-full" />
            <h2 className="text-sm font-bold text-gray-700">趨勢分析</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <p className="font-bold text-gray-700 text-sm mb-3">近 30 天每日下單客戶</p>
              <StackedBars items={trends.daily} aKey="new_customers" bKey="returning_customers"
                aColor="#93c5fd" bColor="#16a34a" aLabel="新客" bLabel="回頭客"
                firstLabel={trends.daily[0]?.date.slice(5)} lastLabel={trends.daily[trends.daily.length - 1]?.date.slice(5)} />
            </div>
            <div className="card p-4">
              <p className="font-bold text-gray-700 text-sm mb-3">近 6 個月營收：新客 vs 老客</p>
              <StackedBars items={trends.monthly} aKey="new_rev" bKey="returning_rev"
                aColor="#93c5fd" bColor="#16a34a" aLabel="新客營收" bLabel="老客營收"
                firstLabel={trends.monthly[0]?.month} lastLabel={trends.monthly[trends.monthly.length - 1]?.month} />
            </div>
            <div className="card p-4">
              <p className="font-bold text-gray-700 text-sm mb-3">近 8 週沉睡 / 流失客戶</p>
              <LineChart items={trends.weekly}
                series={[{ key: 'dormant', color: '#ea580c', label: '沉睡客' }, { key: 'lost', color: '#9ca3af', label: '流失客' }]}
                firstLabel={trends.weekly[0]?.date.slice(5)} lastLabel={trends.weekly[trends.weekly.length - 1]?.date.slice(5)} />
            </div>
          </div>
        </>
      )}

      {/* 商品復購洞察 */}
      {products && (products.repurchase_ranking.length > 0 || products.next_product_ranking.length > 0) && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-gray-300 rounded-full" />
            <h2 className="text-sm font-bold text-gray-700">商品復購洞察</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* 回購率最高商品 */}
            <div className="card p-4">
              <p className="font-bold text-gray-700 text-sm mb-1">🔁 回購率最高的商品 Top 5</p>
              <p className="text-[13px] text-gray-600 mb-3">買過的客戶中，有多少比例會再次回購同一商品</p>
              {products.repurchase_ranking.length === 0 ? (
                <p className="text-gray-600 text-sm py-6 text-center">資料還不足以計算</p>
              ) : (
                <div className="space-y-2.5">
                  {products.repurchase_ranking.map((p: any, i: number) => (
                    <div key={p.product_id} className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-[13px] flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${p.repurchase_rate}%` }} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold text-green-700">{p.repurchase_rate}%</p>
                        <p className="text-[13px] text-gray-600">{p.repeat_buyers}/{p.buyers} 人</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 首購後最常回購的第二件商品 */}
            <div className="card p-4">
              <p className="font-bold text-gray-700 text-sm mb-1">🛒 首購後最常回購的商品 Top 5</p>
              <p className="text-[13px] text-gray-600 mb-3">老客回頭時最常「加購」的新品項（首單沒買過的）</p>
              {products.next_product_ranking.length === 0 ? (
                <p className="text-gray-600 text-sm py-6 text-center">資料還不足以計算</p>
              ) : (
                <div className="space-y-2.5">
                  {products.next_product_ranking.map((p: any, i: number) => (
                    <div key={p.product_id} className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[13px] flex items-center justify-center">{i + 1}</span>
                      <p className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      <span className="flex-shrink-0 text-sm font-bold text-blue-700">{p.customers} 位回購</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 待喚醒名單 CTA */}
      {summary && summary.due_count > 0 && segment !== 'due' && (
        <div className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-bold text-amber-900">⏰ 有 {summary.due_count} 位客戶已過預估回購時間還沒回來</p>
            <p className="text-amber-700 text-sm mt-0.5">這些是最該主動用 LINE 聯繫、提醒回購的名單</p>
          </div>
          <button onClick={showDueList}
            className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl px-4 py-2.5 transition-colors">
            查看待喚醒名單 →
          </button>
        </div>
      )}

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
            <button key={s.value} onClick={() => { setSegment(s.value); if (s.value === 'due') setSort('due_desc'); setPage(1) }}
              className={'px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ' + (segment === s.value ? (s.value === 'due' ? 'bg-amber-600 text-white' : 'bg-green-700 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-600 text-lg">載入中...</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center"><div className="text-4xl mb-3">🧑‍🤝‍🧑</div><p className="text-gray-600 text-lg">此條件下沒有客戶</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['客戶', '分層', '訂單筆數', '累計金額', '客單價', '最後消費', '預估回購', '操作'].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-bold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.phone} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-800">{c.customer_name || '—'}</div>
                      <div className="text-gray-500 font-mono text-[13px]">{c.phone}</div>
                      {c.line_id ? (
                        <div className="text-[13px] text-green-600 mt-0.5">💬 {c.line_id}</div>
                      ) : (
                        <div className="text-[13px] text-gray-300 mt-0.5">未留 LINE</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={'text-[13px] font-bold px-2 py-1 rounded-full ' + (SEGMENT_COLOR[c.segment] || 'bg-gray-100 text-gray-600')}>{c.segment_label}</span>
                    </td>
                    <td className="px-3 py-3 font-bold text-gray-800">{c.order_count}</td>
                    <td className="px-3 py-3 font-bold text-green-700 whitespace-nowrap">{formatMoney(c.total_amount)}</td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatMoney(c.avg_order_value)}</td>
                    <td className="px-3 py-3 text-gray-500 text-[13px] whitespace-nowrap">{formatDate(c.last_order_at)}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                      {c.expected_next_at ? (
                        <>
                          <div className="text-gray-600">{formatDate(c.expected_next_at)}</div>
                          {c.overdue_days > 0 ? (
                            <span className="text-red-500 font-bold">已逾 {c.overdue_days} 天</span>
                          ) : c.overdue_days > -7 ? (
                            <span className="text-amber-600 font-bold">即將到期</span>
                          ) : (
                            <span className="text-gray-600">還有 {-c.overdue_days} 天</span>
                          )}
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => copyContact(c)}
                          className="text-[13px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white transition-colors whitespace-nowrap">
                          複製聯絡
                        </button>
                        <Link href={`/admin/orders?search=${encodeURIComponent(c.phone)}`}
                          className="text-[13px] font-bold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-700 transition-colors whitespace-nowrap">
                          訂單
                        </Link>
                      </div>
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
