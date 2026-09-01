'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { formatDateTime, formatPrice, getStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

function CopyIconButton({ value, label }: { value: string; label: string }) {
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`已複製${label}`)
    } catch {
      toast.error('複製失敗，請手動選取')
    }
  }
  return (
    <button onClick={handleCopy} title={`複製${label}`}
      className="text-gray-300 hover:text-blue-600 transition-colors flex-shrink-0">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  )
}

const ORDER_STATUSES = ['待確認','已確認','備貨中','已出貨','已到店','已取消']
const DATE_RANGES = [
  { value: '', label: '全部' },
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: '3days', label: '近3天' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自訂' },
]

function OrderRow({ order, onStatusChange, onDelete, selected, onToggleSelect }: { order: any; onStatusChange: (id:number, s:string) => void; onDelete: (id: number) => void; selected: boolean; onToggleSelect: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [newStatus, setNewStatus] = useState(order.order_status)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    const stockNote = order.order_status !== '已取消'
      ? '\n\n⚠️ 此訂單尚未取消，刪除前將自動回補庫存。'
      : ''
    if (!confirm(`確定要永久刪除訂單 ${order.order_no}？${stockNote}\n\n此操作無法還原！`)) return
    if (!confirm(`再次確認：將永久刪除訂單 ${order.order_no} 及其商品明細，無法復原。`)) return

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/orders/' + order.id, { method: 'DELETE' })
      const d = await res.json()
      if (d.success) {
        toast.success(d.message || '訂單已刪除')
        onDelete(order.id)
      } else {
        toast.error(d.error || '刪除失敗')
      }
    } catch {
      toast.error('刪除失敗')
    } finally {
      setDeleting(false)
    }
  }

  const loadDetail = async () => {
    if (detail) return
    setLoadingDetail(true)
    const res = await fetch('/api/admin/orders/' + order.id)
    const d = await res.json()
    if (d.success) setDetail(d.data)
    setLoadingDetail(false)
  }

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next) loadDetail()
  }

  const handleCopyInfo = async () => {
    if (!detail) return
    const text = `${detail.customer_name} ${detail.phone} ${detail.store_name}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已複製姓名、手機、門市')
    } catch {
      toast.error('複製失敗，請手動選取')
    }
  }

  const handleStatusUpdate = async () => {
    if (newStatus === order.order_status) return
    if (newStatus === '已取消' && !confirm('確定要取消訂單 ' + order.order_no + '？\n取消後將自動回補庫存。')) {
      setNewStatus(order.order_status); return
    }
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/orders/' + order.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_status: newStatus }),
      })
      const d = await res.json()
      if (d.success) {
        toast.success('狀態已更新' + (newStatus === '已取消' ? '，庫存已回補' : ''))
        onStatusChange(order.id, newStatus)
      } else {
        toast.error(d.error || '更新失敗')
        setNewStatus(order.order_status)
      }
    } catch { toast.error('更新失敗'); setNewStatus(order.order_status) }
    finally { setUpdating(false) }
  }

  return (
    <>
      <tr className={'border-b border-gray-100 transition-colors cursor-pointer ' + (expanded ? 'bg-green-50' : 'hover:bg-gray-50')} onClick={handleExpand}>
        <td className="pl-4 pr-2 py-4 w-8" onClick={e => e.stopPropagation()}>
          <input type="checkbox" className="w-4 h-4 rounded accent-green-700 cursor-pointer" checked={selected} onChange={() => onToggleSelect(order.id)} />
        </td>
        <td className="pl-2 pr-2 py-4 w-8">
          <div className={'w-6 h-6 flex items-center justify-center text-gray-600 transition-transform duration-200 ' + (expanded ? 'rotate-90 text-green-600' : '')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
          </div>
        </td>
        <td className="px-3 py-4"><span className="font-mono font-bold text-gray-800 text-[13px]">{order.order_no}</span></td>
        <td className="px-3 py-4 text-gray-500 text-[13px] whitespace-nowrap">{formatDateTime(order.created_at)}</td>
        <td className="px-3 py-4">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-semibold text-gray-800">{order.customer_name}</span>
            {order.purchase_seq ? (
              <span
                title={`此客戶累計購買 ${order.customer_orders} 次`}
                className={'text-[13px] font-bold px-1.5 py-0.5 rounded-md border ' + (
                  order.purchase_seq === 1
                    ? 'bg-gray-100 text-gray-500 border-gray-200'
                    : order.purchase_seq === 2
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-orange-50 text-orange-600 border-orange-200'
                )}>
                {order.purchase_seq === 1 ? '新客' : `第${order.purchase_seq}次`}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-3 py-4 text-gray-600 font-mono text-sm">{order.phone}</td>
        <td className="px-3 py-4 text-gray-600 text-sm max-w-28 truncate">{order.store_name}</td>
        <td className="px-3 py-4 font-bold text-green-700 whitespace-nowrap">{formatPrice(order.total_amount)}</td>
        <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
          <span className={'status-badge ' + getStatusColor(newStatus)}>{newStatus}</span>
        </td>
        <td className="pl-2 pr-4 py-4" onClick={e => e.stopPropagation()}>
          <button onClick={handleExpand} className={'text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ' + (expanded ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-700')}>
            {expanded ? '收起' : '展開'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-green-50/40">
          <td colSpan={10} className="px-4 pb-5 pt-1">
            {loadingDetail ? (
              <div className="py-8 text-center text-gray-600">載入詳情中...</div>
            ) : detail ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                {/* Customer */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-gray-600 text-[13px] uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center">👤</span>客戶資料
                    </h4>
                    <button onClick={e => { e.stopPropagation(); handleCopyInfo() }}
                      className="flex items-center gap-1 text-[13px] font-bold text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-lg px-2 py-1 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      複製
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { l: '姓名', v: detail.customer_name, copy: detail.customer_name },
                      { l: '手機', v: detail.phone, copy: detail.phone },
                      { l: 'LINE ID', v: detail.line_id || <span className="text-gray-600">未提供</span>, copy: '' },
                      { l: '備註', v: detail.note || <span className="text-gray-600">無</span>, copy: '' },
                    ].map((f, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-gray-600 text-[13px] w-14 flex-shrink-0 pt-0.5">{f.l}</span>
                        <span className="text-sm font-semibold text-gray-800 break-all flex-1">{f.v}</span>
                        {f.copy && <CopyIconButton value={f.copy} label={f.l} />}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Store + Status */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <h4 className="font-bold text-gray-600 mb-3 text-[13px] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 bg-green-50 rounded flex items-center justify-center">🏪</span>取貨門市
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800 text-base">{detail.store_name}</p>
                    <CopyIconButton value={detail.store_name} label="門市名稱" />
                  </div>
                  <p className="text-green-700 text-sm font-semibold mt-0.5">{detail.county}{detail.district}</p>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{detail.store_address}</p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="font-bold text-gray-600 text-[13px] uppercase tracking-wider mb-2">更新訂單狀態</p>
                    <div className="flex gap-2">
                      <select value={newStatus} onChange={e => setNewStatus(e.target.value)} onClick={e => e.stopPropagation()}
                        className="flex-1 border-2 border-gray-200 rounded-xl px-3 text-sm font-semibold focus:outline-none focus:border-green-500 bg-white"
                        style={{ height: '40px' }}>
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={e => { e.stopPropagation(); handleStatusUpdate() }}
                        disabled={updating || newStatus === order.order_status}
                        className="px-4 bg-green-700 hover:bg-green-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
                        style={{ height: '40px' }}>
                        {updating ? '更新...' : '確認'}
                      </button>
                    </div>
                    {newStatus === '已取消' && newStatus !== order.order_status && (
                      <p className="text-red-500 text-[13px] mt-1.5 font-medium">⚠️ 取消後將自動回補庫存，無法還原</p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button onClick={e => { e.stopPropagation(); handleDelete() }}
                      disabled={deleting}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold text-red-600 hover:text-white border-2 border-red-200 hover:bg-red-600 hover:border-red-600 rounded-xl py-2.5 transition-colors disabled:opacity-40">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      {deleting ? '刪除中...' : '永久刪除此訂單'}
                    </button>
                    <p className="text-red-500 text-[13px] mt-1.5 text-center">⚠️ 將同步刪除商品明細，無法還原</p>
                  </div>
                </div>
                {/* Items */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <h4 className="font-bold text-gray-600 mb-3 text-[13px] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 bg-purple-50 rounded flex items-center justify-center">📦</span>
                    商品明細（{detail.items_count} 件）
                  </h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {detail.order_items?.map((item: any) => (
                      <div key={item.id} className="flex gap-3 items-start">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden relative flex-shrink-0">
                          {item.product_image_snapshot
                            ? <Image src={item.product_image_snapshot} alt={item.product_name_snapshot} fill className="object-cover" sizes="40px" />
                            : <div className="w-full h-full flex items-center justify-center text-sm">💊</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-800 line-clamp-1">{item.product_name_snapshot}</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">{item.variant_name_snapshot}</p>
                          {item.sku_snapshot && <p className="text-[13px] text-gray-600 font-mono">SKU: {item.sku_snapshot}</p>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-[13px] text-gray-600">{formatPrice(item.unit_price)} × {item.quantity}</p>
                          <p className="text-sm font-bold text-gray-800">{formatPrice(item.subtotal)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-sm text-gray-500">訂單總額</span>
                    <span className="text-lg font-bold text-green-700">{formatPrice(detail.total_amount)}</span>
                  </div>
                </div>
              </div>
            ) : <div className="py-4 text-center text-gray-600">無法載入詳情</div>}
          </td>
        </tr>
      )}
    </>
  )
}

function OrdersContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [dateOverridden, setDateOverridden] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (dateRange) params.set('dateRange', dateRange)
    if (dateRange === 'custom' && startDate && endDate) { params.set('startDate', startDate); params.set('endDate', endDate) }
    const res = await fetch('/api/admin/orders?' + params)
    const data = await res.json()
    if (data.success) {
      setOrders(data.data); setTotal(data.total)
      setDateOverridden(!!data.date_filter_overridden)
    }
    setLoading(false)
  }, [search, status, dateRange, startDate, endDate, page, pageSize])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { setSelectedIds([]) }, [orders])

  const handleStatusChange = (id: number, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, order_status: newStatus } : o))
  }

  const handleDelete = (id: number) => {
    setOrders(prev => prev.filter(o => o.id !== id))
    setTotal(t => Math.max(0, t - 1))
    setSelectedIds(prev => prev.filter(i => i !== id))
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const allSelected = orders.length > 0 && selectedIds.length === orders.length
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : orders.map(o => o.id))
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`確定要永久刪除選中的 ${selectedIds.length} 筆訂單？\n\n⚠️ 尚未取消的訂單將自動回補庫存。\n此操作無法還原！`)) return
    if (!confirm(`再次確認：將永久刪除 ${selectedIds.length} 筆訂單及其商品明細，無法復原。`)) return

    setBulkDeleting(true)
    try {
      const res = await fetch('/api/admin/orders/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const d = await res.json()
      if (d.deleted?.length) {
        setOrders(prev => prev.filter(o => !d.deleted.includes(o.id)))
        setTotal(t => Math.max(0, t - d.deleted.length))
        setSelectedIds([])
      }
      if (d.success) {
        toast.success(d.message || '訂單已刪除')
      } else {
        toast.error(d.error || d.message || '部分訂單刪除失敗')
      }
    } catch {
      toast.error('刪除失敗')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">訂單管理</h1>
          <p className="text-gray-600 text-sm mt-0.5">共 {total} 筆訂單・點擊列可展開查看詳情</p>
        </div>
        {selectedIds.length > 0 && (
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            {bulkDeleting ? '刪除中...' : `刪除選中 (${selectedIds.length})`}
          </button>
        )}
      </div>

      <div className="card p-4 mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="form-input flex-1 py-2" style={{ height: '44px' }} placeholder="搜尋訂單號、姓名、手機..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <select className="form-input sm:w-36" style={{ height: '44px' }} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="">全部狀態</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-input sm:w-32" style={{ height: '44px' }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
            {[20, 50, 100, 200].map(n => <option key={n} value={n}>每頁 {n} 筆</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_RANGES.map(d => (
            <button key={d.value} onClick={() => { setDateRange(d.value); setPage(1) }}
              className={'px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ' + (dateRange === d.value ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {d.label}
            </button>
          ))}
        </div>
        {dateOverridden && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
            <p className="text-[13px] text-blue-800 leading-relaxed">
              🔍 搜尋時會查詢<strong>全部期間</strong>，上方的期間篩選暫時不套用 ——
              否則您要找的舊訂單會被擋在期間外。清空搜尋框即可恢復期間篩選。
            </p>
          </div>
        )}

        {dateRange === 'custom' && (
          <div className="flex flex-wrap gap-3 items-center">
            <input type="date" className="form-input w-auto" style={{ height: '44px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-500">至</span>
            <input type="date" className="form-input w-auto" style={{ height: '44px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
            <button onClick={fetchOrders} disabled={!startDate || !endDate} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">查詢</button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-600 text-lg">載入中...</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center"><div className="text-4xl mb-3">📋</div><p className="text-gray-600 text-lg">此條件下沒有訂單</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-8 pl-4 pr-2 py-3">
                    <input type="checkbox" className="w-4 h-4 rounded accent-green-700 cursor-pointer" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th className="w-8 pl-2 pr-2 py-3"></th>
                  {['訂單編號','下單時間','姓名','手機','門市','金額','狀態','操作'].map(h => (
                    <th key={h} className="text-left px-3 py-3 font-bold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <OrderRow key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete}
                    selected={selectedIds.includes(order.id)} onToggleSelect={toggleSelect} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > pageSize && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold disabled:opacity-40 hover:bg-gray-50">← 上一頁</button>
            <span className="text-sm text-gray-500">第 {page} / {Math.ceil(total / pageSize)} 頁</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold disabled:opacity-40 hover:bg-gray-50">下一頁 →</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="py-16 text-center text-gray-600">載入中...</div>}><OrdersContent /></Suspense>
}
