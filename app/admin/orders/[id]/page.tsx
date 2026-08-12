'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { formatDateTime, formatPrice, getStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

const ORDER_STATUSES = ['待確認','已確認','備貨中','已出貨','已到店','已取消']

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    fetch(`/api/admin/orders/${params.id}`).then(r => r.json()).then(d => {
      if (d.success) { setOrder(d.data); setNewStatus(d.data.order_status) }
      setLoading(false)
    })
  }, [params.id])

  const handleUpdateStatus = async () => {
    if (newStatus === order.order_status) return
    if (newStatus === '已取消' && !confirm(`確定要取消訂單 ${order.order_no}？\n取消後將自動回補庫存。`)) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_status: newStatus }) })
      const data = await res.json()
      if (data.success) {
        setOrder((prev: any) => ({ ...prev, order_status: newStatus }))
        toast.success('訂單狀態已更新' + (newStatus === '已取消' ? '，庫存已回補' : ''))
      } else toast.error(data.error || '更新失敗')
    } catch { toast.error('更新失敗') }
    finally { setUpdating(false) }
  }

  if (loading) return <div className="py-16 text-center text-gray-600">載入中...</div>
  if (!order) return <div className="py-16 text-center text-gray-500">訂單不存在</div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-semibold">← 返回</button>
        <h1 className="text-xl font-bold text-gray-800">訂單詳情</h1>
      </div>

      {/* Header */}
      <div className="card p-5 mb-5">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">訂單編號</p>
            <p className="text-xl font-bold font-mono text-gray-800">{order.order_no}</p>
            <p className="text-sm text-gray-500 mt-1">{formatDateTime(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="form-input py-2 w-36" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleUpdateStatus} disabled={updating || newStatus === order.order_status} className="btn-primary py-2 px-4 text-base disabled:opacity-40">
              {updating ? '更新中...' : '更新狀態'}
            </button>
          </div>
        </div>
        <div className="mt-3"><span className={`status-badge ${getStatusColor(order.order_status)} text-base`}>{order.order_status}</span></div>
      </div>

      {/* Customer info */}
      <div className="card p-5 mb-5">
        <h2 className="font-bold text-gray-800 text-lg mb-4">客戶資料</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '姓名', value: order.customer_name },
            { label: '手機號碼', value: order.phone },
            { label: 'LINE ID', value: order.line_id || '未提供' },
            { label: '備註', value: order.note || '無' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[13px] text-gray-500 mb-0.5">{f.label}</p>
              <p className="font-semibold text-gray-800">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Store info */}
      <div className="card p-5 mb-5">
        <h2 className="font-bold text-gray-800 text-lg mb-4">取貨門市</h2>
        <p className="text-xl font-bold text-gray-800 mb-1">{order.store_name}</p>
        <p className="text-green-700">{order.county}{order.district}</p>
        <p className="text-gray-600 mt-1">{order.store_address}</p>
      </div>

      {/* Order items */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-lg mb-4">商品明細</h2>
        <div className="space-y-4 mb-4">
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden relative flex-shrink-0">
                {item.product_image_snapshot ? (
                  <Image src={item.product_image_snapshot} alt={item.product_name_snapshot} fill className="object-cover" sizes="64px" />
                ) : <div className="w-full h-full flex items-center justify-center text-2xl">💊</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{item.product_name_snapshot}</p>
                <p className="text-gray-500 text-sm mt-0.5">{item.variant_name_snapshot}</p>
                {item.sku_snapshot && <p className="text-gray-600 text-[13px] mt-0.5">SKU: {item.sku_snapshot}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-500 text-sm">{formatPrice(item.unit_price)} × {item.quantity}</span>
                  <span className="font-bold text-gray-800">{formatPrice(item.subtotal)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-gray-200 pt-4 flex justify-between items-center">
          <span className="text-lg font-bold text-gray-700">訂單總額</span>
          <span className="text-2xl font-bold text-green-700">{formatPrice(order.total_amount)}</span>
        </div>
      </div>
    </div>
  )
}
