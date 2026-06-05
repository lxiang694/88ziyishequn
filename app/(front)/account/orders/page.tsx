'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUserAuth, useRequireUser } from '@/components/front/UserAuthContext'
import { useCart } from '@/components/front/CartContext'
import { formatPrice, formatDateTime, getStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function MemberOrdersPage() {
  const router = useRouter()
  const { user, loading } = useRequireUser()
  const { authedFetch } = useUserAuth()
  const { addItem } = useCart()
  const [orders, setOrders] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    authedFetch('/api/account/orders').then(r => r.json()).then(d => {
      if (d.success) setOrders(d.data)
      setLoadingData(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const reorder = async (order: any) => {
    // Re-fetch each item's product to get current variants
    let added = 0
    let skipped = 0
    for (const item of order.order_items || []) {
      // We saved snapshot data, but to add to cart we need product_id + variant_id
      // The order_items table has product_id and variant_id (which we don't select here)
      // Re-fetch order detail or fetch variants directly
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(item.product_name_snapshot.split(' ')[0])}`)
        const d = await res.json()
        const product = d.data?.find((p: any) => p.product_name === item.product_name_snapshot)
        if (product) {
          const variant = product.product_variants?.find((v: any) => v.variant_name === item.variant_name_snapshot && v.is_active && v.stock_qty > 0)
          if (variant) {
            addItem({
              product_id: product.id,
              product_name: product.product_name,
              product_slug: product.slug,
              cover_image_url: product.cover_image_url,
              variant_id: variant.id,
              variant_name: variant.variant_name,
              sku_code: variant.sku_code,
              unit_price: variant.sale_price,
              quantity: item.quantity,
              stock_qty: variant.stock_qty,
            })
            added++
          } else { skipped++ }
        } else { skipped++ }
      } catch { skipped++ }
    }
    if (added > 0) {
      toast.success(`已加入 ${added} 件商品到購物車${skipped > 0 ? `（${skipped} 件已下架或缺貨）` : ''}`)
      router.push('/cart')
    } else {
      toast.error('無法再買一次（商品可能已下架或缺貨）')
    }
  }

  if (loading || loadingData) return <div className="py-20 text-center text-gray-400">載入中...</div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <Link href="/account" className="hover:text-green-700">會員中心</Link>
          <span>›</span>
          <span className="text-gray-700">我的訂單</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">我的訂單</h1>
        <p className="text-sm text-gray-500 mb-5">共 {orders.length} 筆</p>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
            <div className="text-5xl mb-3">🛒</div>
            <p className="text-gray-400 mb-5">還沒有訂單</p>
            <Link href="/" className="btn-primary inline-flex">去逛逛</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button onClick={() => setExpanded(e => e === order.id ? null : order.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-mono text-xs font-bold text-gray-700">{order.order_no}</p>
                      <span className={`status-badge ${getStatusColor(order.order_status)} text-xs`}>{order.order_status}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{order.store_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.created_at)} · {order.items_count} 件</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-700 text-lg">{formatPrice(order.total_amount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{expanded === order.id ? '收起 ▲' : '展開 ▼'}</p>
                  </div>
                </button>

                {expanded === order.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    <p className="text-xs font-bold text-gray-500 mb-3 tracking-wide">商品明細</p>
                    <div className="space-y-2 mb-4">
                      {(order.order_items || []).map((item: any) => (
                        <div key={item.id} className="flex gap-3 items-center bg-white rounded-xl p-2.5">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 relative flex-shrink-0">
                            {item.product_image_snapshot ? (
                              <Image src={item.product_image_snapshot} alt={item.product_name_snapshot} fill className="object-cover" sizes="48px" />
                            ) : <div className="w-full h-full flex items-center justify-center">💊</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 line-clamp-1">{item.product_name_snapshot}</p>
                            <p className="text-xs text-gray-500">{item.variant_name_snapshot} × {item.quantity}</p>
                          </div>
                          <p className="font-bold text-gray-700 text-sm flex-shrink-0">{formatPrice(item.subtotal)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-gray-500 mb-4 space-y-1">
                      <p>📍 取貨門市：{order.store_name} ({order.county}{order.district})</p>
                      <p>📞 聯絡手機：{order.phone}</p>
                    </div>

                    <button onClick={() => reorder(order)}
                      className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded-xl transition-colors">
                      🔁 再買一次
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
