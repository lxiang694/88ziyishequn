'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, formatDateTime } from '@/lib/utils'

interface OrderItem {
  id: number
  product_name_snapshot: string
  product_image_snapshot: string | null
  variant_name_snapshot: string
  unit_price: number
  quantity: number
  subtotal: number
}

interface Order {
  order_no: string
  order_status: string
  customer_name: string
  phone: string
  total_amount: number
  items_count: number
  store_name: string
  store_address: string
  county: string
  district: string
  created_at: string
  order_items: OrderItem[]
}

function OrderSuccessContent() {
  const searchParams = useSearchParams()
  const order_no = searchParams.get('order_no') || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!order_no) { setLoading(false); return }
    fetch(`/api/orders/by-order-no/${encodeURIComponent(order_no)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setOrder(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [order_no])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Success animation */}
      <div className="text-center mb-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">下單成功！</h1>
        <p className="text-gray-500 text-base">感謝您的購買，我們將盡快為您備貨</p>
      </div>

      {/* Order number — prominent */}
      {order_no && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-5 mb-5 text-center">
          <p className="text-sm text-green-700 font-bold mb-2">📋 您的訂單編號</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-900 font-mono tracking-wider mb-2 select-all">
            {order_no}
          </p>
          <p className="text-[13px] text-green-700 leading-relaxed">
            💡 建議您<strong>截圖保存</strong>此編號，方便日後查詢訂單
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center mb-5">
          <p className="text-gray-600">載入訂單詳情中...</p>
        </div>
      )}

      {/* Order details */}
      {!loading && order && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-bold text-gray-700">📦 訂單明細</span>
              <span className="text-[13px] text-gray-500">{formatDateTime(order.created_at)}</span>
            </div>
          </div>

          {/* Items */}
          <div className="px-5 py-4 space-y-3">
            {order.order_items?.map(item => (
              <div key={item.id} className="flex gap-3 items-start">
                <div className="w-16 h-16 rounded-xl bg-gray-100 relative flex-shrink-0 overflow-hidden">
                  {item.product_image_snapshot
                    ? <Image src={item.product_image_snapshot} alt={item.product_name_snapshot} fill className="object-cover" sizes="64px" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">💊</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm leading-relaxed line-clamp-2">{item.product_name_snapshot}</p>
                  <p className="text-gray-500 text-[13px] mt-0.5">{item.variant_name_snapshot}</p>
                  <p className="text-gray-600 text-[13px] mt-1">
                    {formatPrice(item.unit_price)} × {item.quantity}
                  </p>
                </div>
                <p className="font-bold text-gray-800 text-sm flex-shrink-0 whitespace-nowrap">{formatPrice(item.subtotal)}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>商品小計（{order.items_count} 件）</span>
              <span>{formatPrice(order.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>運費</span>
              <span className="text-green-700 font-bold">免運</span>
            </div>
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
              <span className="text-base font-bold text-gray-800">應付總金額</span>
              <span className="text-2xl font-bold text-green-700">{formatPrice(order.total_amount)}</span>
            </div>
            <p className="text-[13px] text-gray-500 text-right mt-1">取貨時於 7-11 櫃台付款</p>
          </div>

          {/* Pickup store */}
          <div className="px-5 py-4 border-t border-gray-100 bg-green-50/50">
            <p className="text-[13px] font-bold text-gray-500 mb-1">🏪 取貨門市</p>
            <p className="font-bold text-gray-800">{order.store_name}</p>
            <p className="text-green-700 text-sm font-semibold mt-0.5">{order.county}{order.district}</p>
            <p className="text-gray-500 text-sm mt-1">{order.store_address}</p>
          </div>
        </div>
      )}

      {/* What's next */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 mb-5">
        <p className="font-bold text-blue-900 mb-3 text-base">📦 接下來的流程</p>
        <div className="space-y-2.5">
          {[
            { t: '客服確認訂單', d: '我們會在 1 個工作日內透過 LINE / 簡訊通知您' },
            { t: '備貨與出貨', d: '現貨商品約 3 個工作日寄出，預購商品約 7 個工作日' },
            { t: '到店通知', d: '商品送達 7-11 後，我們會再次通知您前往取貨' },
            { t: '7-11 取貨付款', d: '憑訂單編號或手機號碼至門市櫃台，現金或行動支付付款' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-blue-900">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold mt-0.5">{i + 1}</span>
              <div className="flex-1">
                <p className="font-bold">{s.t}</p>
                <p className="text-blue-700 text-[13px] mt-0.5 leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to query order */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 mb-5">
        <p className="font-bold text-amber-900 mb-3 text-base">🔍 之後想查訂單狀態？有兩種方式</p>
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-4 border border-amber-100">
            <p className="font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-[13px] font-bold">1</span>
              用「下單時填的手機號碼」查
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-2 ml-8">不需註冊，直接到訂單查詢頁輸入手機就能查</p>
            <Link href="/orders"
              className="ml-8 inline-flex items-center gap-1 text-amber-700 font-bold text-sm hover:text-amber-800">
              📦 前往訂單查詢
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>

          <div className="bg-white rounded-xl p-4 border border-amber-100">
            <p className="font-bold text-gray-800 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-[13px] font-bold">2</span>
              註冊會員，跨裝置看訂單紀錄
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-2 ml-8">註冊後系統會自動關聯您所有以此手機號碼的訂單，下次結帳資料也會自動帶入</p>
            <Link href="/signup"
              className="ml-8 inline-flex items-center gap-1 text-amber-700 font-bold text-sm hover:text-amber-800">
              ✨ 免費註冊會員
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Contact 小莊 */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#06C755] rounded-xl flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 48 48" fill="white">
              <path d="M24 4C13 4 4 11.8 4 21.4c0 8.3 7.4 15.3 17.4 16.7.7.1 1.6.5 1.8 1 .2.5.1 1.3 0 1.8l-.3 1.8c-.1.5-.4 2 1.8 1.1 2.2-.9 11.8-7 16.1-12C43.8 29 44 25.3 44 21.4 44 11.8 35 4 24 4z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 mb-1">有疑問？聯絡小莊</p>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              不論訂單變更、退換貨、商品問題，都可以直接傳訊息給我
            </p>
            <a href="https://line.me/ti/p/yw13134" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">
              加 LINE 找小莊
              <span className="text-[13px] opacity-90">ID：yw13134</span>
            </a>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/orders" className="flex-1 border-2 border-green-700 text-green-700 font-bold py-3.5 rounded-xl text-base hover:bg-green-50 transition-colors text-center">
          查詢訂單狀態
        </Link>
        <Link href="/" className="flex-1 btn-primary text-center">
          繼續購物
        </Link>
      </div>
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-600">載入中...</div>}>
      <OrderSuccessContent />
    </Suspense>
  )
}
