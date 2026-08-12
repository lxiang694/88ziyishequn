'use client'
import { useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice, formatDateTime, getStatusColor } from '@/lib/utils'
import { validateTWPhone } from '@/lib/utils'
import toast from 'react-hot-toast'

interface OrderItem { id: number; product_name_snapshot: string; product_image_snapshot: string | null; variant_name_snapshot: string; unit_price: number; quantity: number; subtotal: number }
interface Order { id: number; order_no: string; created_at: string; order_status: string; store_name: string; store_address: string; county: string; district: string; total_amount: number; items_count: number; order_items: OrderItem[] }

const XIAOJUANG_LINE_URL = 'https://line.me/ti/p/yw13134'
const XIAOJUANG_LINE_ID = 'yw13134'

const STATUS_STEP: Record<string, number> = {
  '待確認': 1, '已確認': 2, '備貨中': 3, '已出貨': 4, '已到店': 5, '已取消': 0,
}

function StatusProgress({ status }: { status: string }) {
  if (status === '已取消') {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-sm">✕</span>
        <span className="text-red-600 font-semibold text-sm">此訂單已取消</span>
      </div>
    )
  }
  const steps = ['待確認', '已確認', '備貨中', '已出貨', '已到店']
  const current = STATUS_STEP[status] || 1
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      {steps.map((step, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={step} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors
                ${done ? 'bg-green-600 text-white' : active ? 'bg-green-700 text-white ring-2 ring-green-300' : 'bg-gray-100 text-gray-600'}`}>
                {done ? '✓' : idx}
              </div>
              <span className={`text-[13px] font-medium whitespace-nowrap ${active ? 'text-green-700 font-bold' : done ? 'text-green-600' : 'text-gray-600'}`}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 flex-shrink-0 rounded ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ContactXiaojuangCard({ context }: { context: 'no-orders' | 'with-orders' | 'default' }) {
  const titleMap = {
    'no-orders': '找不到訂單嗎？讓小莊幫您查',
    'with-orders': '訂單有問題？需要修改？',
    'default': '有不懂的問題嗎？聯絡小莊',
  }

  const subMap = {
    'no-orders': '可能是手機號碼輸入錯誤，或您是用其他號碼下單。直接傳訊息給小莊，幫您快速查詢',
    'with-orders': '訂單一旦成立就無法線上修改，但小莊都能幫您處理',
    'default': '不論訂單、商品、退換貨任何疑問，小莊都會親自回覆您',
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl border-2 border-green-200 p-6 mt-8 shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 bg-[#06C755] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="white">
            <path d="M24 4C13 4 4 11.8 4 21.4c0 8.3 7.4 15.3 17.4 16.7.7.1 1.6.5 1.8 1 .2.5.1 1.3 0 1.8l-.3 1.8c-.1.5-.4 2 1.8 1.1 2.2-.9 11.8-7 16.1-12C43.8 29 44 25.3 44 21.4 44 11.8 35 4 24 4z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-lg leading-relaxed">{titleMap[context]}</p>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{subMap[context]}</p>
        </div>
      </div>

      <p className="text-sm text-gray-700 font-bold mb-2">小莊可以幫您處理：</p>
      <ul className="space-y-1.5 mb-5">
        {[
          '訂單查詢與物流狀態確認',
          '修改取貨門市、聯絡資料',
          '退換貨諮詢與後續處理',
          '商品成分、用法、保存問題',
          '其他任何下單、寄送、付款疑問',
        ].map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-600 font-bold flex-shrink-0">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <a
        href={XIAOJUANG_LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-md"
      >
        <svg width="22" height="22" viewBox="0 0 48 48" fill="white">
          <path d="M24 4C13 4 4 11.8 4 21.4c0 8.3 7.4 15.3 17.4 16.7.7.1 1.6.5 1.8 1 .2.5.1 1.3 0 1.8l-.3 1.8c-.1.5-.4 2 1.8 1.1 2.2-.9 11.8-7 16.1-12C43.8 29 44 25.3 44 21.4 44 11.8 35 4 24 4z"/>
        </svg>
        加 LINE 找小莊
      </a>

      <div className="mt-3 flex flex-col sm:flex-row gap-2 items-center justify-center text-[13px] text-gray-500">
        <span>LINE ID：<strong className="text-gray-700 font-mono">{XIAOJUANG_LINE_ID}</strong></span>
        <span className="hidden sm:inline">·</span>
        <span>通常 1 小時內回覆（深夜除外）</span>
      </div>
    </div>
  )
}

function OrderQueryContent() {
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())

  const handleSearch = async () => {
    if (!phone || !validateTWPhone(phone)) { toast.error('請輸入正確的手機號碼（09xxxxxxxx）'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (data.success) { setOrders(data.data); setSearched(true) }
      else toast.error(data.error || '查詢失敗')
    } catch { toast.error('網路錯誤，請稍後再試') }
    finally { setLoading(false) }
  }

  const toggleExpand = (id: number) => {
    setExpandedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">訂單查詢</h1>
      <p className="text-gray-500 mb-6">
        不用註冊會員，輸入下單時填寫的手機號碼，就可以查到您所有的訂單
      </p>

      {/* Search box */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <label className="form-label">下單時填的手機號碼</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="form-input flex-1"
            type="tel" inputMode="numeric"
            placeholder="09xxxxxxxx"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading}
            className="btn-primary px-6 py-3 text-base whitespace-nowrap flex-shrink-0">
            {loading ? '查詢中...' : '🔍 查詢訂單'}
          </button>
        </div>
        <p className="text-[13px] text-gray-600 mt-2 leading-relaxed">
          💡 系統會找出所有以這個手機號碼下單的訂單記錄
        </p>
      </div>

      {/* Member benefit teaser */}
      {!searched && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-center">
          <p className="text-sm text-blue-800 leading-relaxed">
            👤 想<strong>跨裝置查訂單</strong>、<strong>結帳時自動帶入資料</strong>？
            <Link href="/signup" className="text-blue-700 font-bold underline ml-1">註冊免費會員</Link>
          </p>
        </div>
      )}

      {/* Results */}
      {searched && (
        orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-xl text-gray-700 font-bold mb-2">查無訂單記錄</p>
            <p className="text-gray-500 text-sm leading-relaxed px-6">
              請確認手機號碼是否輸入正確<br />
              或您可能是用其他號碼下單
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 font-medium">
                共找到 <span className="text-green-700 font-bold">{orders.length}</span> 筆訂單
              </p>
            </div>

            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Status header */}
                  <div className={`px-5 py-3 ${order.order_status === '已取消' ? 'bg-red-50' : order.order_status === '已到店' ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] text-gray-500 mb-0.5">訂單編號</p>
                        <p className="font-bold text-gray-800 font-mono tracking-wide">{order.order_no}</p>
                      </div>
                      <span className={`status-badge ${getStatusColor(order.order_status)}`}>{order.order_status}</span>
                    </div>
                    <p className="text-[13px] text-gray-600 mt-1">{formatDateTime(order.created_at)}</p>
                  </div>

                  {/* Progress */}
                  <div className="px-5 py-3 border-b border-gray-50 overflow-x-auto">
                    <StatusProgress status={order.order_status} />
                  </div>

                  {/* Store */}
                  <div className="px-5 py-3 bg-gradient-to-r from-green-50/50 to-transparent border-b border-gray-50">
                    <p className="text-[13px] font-semibold text-gray-500 mb-1">📍 取貨門市</p>
                    <p className="font-bold text-gray-800">{order.store_name}</p>
                    <p className="text-gray-500 text-sm">{order.county}{order.district} · {order.store_address}</p>
                  </div>

                  {/* Items */}
                  <div className="px-5 py-4">
                    <div className="space-y-3">
                      {(expandedOrders.has(order.id) ? order.order_items : order.order_items?.slice(0, 2))?.map(item => (
                        <div key={item.id} className="flex gap-3 items-center">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 relative flex-shrink-0 overflow-hidden">
                            {item.product_image_snapshot
                              ? <Image src={item.product_image_snapshot} alt={item.product_name_snapshot} fill className="object-cover" sizes="48px" />
                              : <div className="w-full h-full flex items-center justify-center text-xl">💊</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm line-clamp-1">{item.product_name_snapshot}</p>
                            <p className="text-gray-500 text-[13px]">{item.variant_name_snapshot} × {item.quantity}</p>
                          </div>
                          <p className="font-bold text-gray-700 text-sm flex-shrink-0">{formatPrice(item.subtotal)}</p>
                        </div>
                      ))}
                    </div>

                    {order.order_items?.length > 2 && (
                      <button onClick={() => toggleExpand(order.id)} className="text-green-700 text-sm font-bold mt-3 hover:underline">
                        {expandedOrders.has(order.id) ? '▲ 收起' : `▼ 顯示全部 ${order.order_items.length} 件商品`}
                      </button>
                    )}

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                      <span className="text-gray-500 text-sm">共 {order.items_count} 件商品</span>
                      <span className="text-xl font-bold text-green-700">{formatPrice(order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* Contact 小莊 card — always shown at bottom */}
      <ContactXiaojuangCard
        context={!searched ? 'default' : orders.length === 0 ? 'no-orders' : 'with-orders'}
      />
    </div>
  )
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="py-20 text-center text-gray-600">載入中...</div>}><OrderQueryContent /></Suspense>
}
