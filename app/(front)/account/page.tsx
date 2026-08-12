'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUserAuth, useRequireUser } from '@/components/front/UserAuthContext'
import { formatPrice, formatDateTime, getStatusColor } from '@/lib/utils'

export default function AccountDashboard() {
  const { user, loading } = useRequireUser()
  const { authedFetch } = useUserAuth()
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [linking, setLinking] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      authedFetch('/api/account/profile').then(r => r.json()),
      authedFetch('/api/account/orders').then(r => r.json()),
    ]).then(([p, o]) => {
      if (p.success) setProfile(p.data)
      if (o.success) setOrders(o.data)
      setLoadingData(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const linkOldOrders = async () => {
    setLinking(true)
    const res = await authedFetch('/api/account/link-orders', { method: 'POST' })
    const d = await res.json()
    if (d.success) {
      setLinkMessage(d.linked > 0 ? `成功關聯 ${d.linked} 筆舊訂單` : '沒有找到可關聯的舊訂單')
      // Refresh orders
      const oRes = await authedFetch('/api/account/orders').then(r => r.json())
      if (oRes.success) setOrders(oRes.data)
    } else {
      setLinkMessage(d.error || '關聯失敗')
    }
    setLinking(false)
  }

  if (loading || loadingData) {
    return <div className="py-20 text-center text-gray-600">載入中...</div>
  }
  if (!user) return null

  const displayName = profile?.name || (user.user_metadata?.name as string) || user.email?.split('@')[0]
  const totalSpent = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const completedOrders = orders.filter(o => !['已取消'].includes(o.order_status)).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">

        {/* Greeting */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-6 text-white shadow-lg shadow-green-100 mb-5">
          <p className="text-green-100 text-sm mb-1">您好，</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{displayName} 👋</h1>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{orders.length}</p>
              <p className="text-[13px] text-green-100 mt-0.5">總訂單數</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{completedOrders}</p>
              <p className="text-[13px] text-green-100 mt-0.5">有效訂單</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-lg font-bold">{formatPrice(totalSpent)}</p>
              <p className="text-[13px] text-green-100 mt-0.5">累計消費</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Link href="/account/orders" className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-green-300 transition-colors">
            <div className="text-3xl mb-1">📦</div>
            <p className="font-bold text-gray-800">我的訂單</p>
            <p className="text-[13px] text-gray-600 mt-0.5">查看訂單與物流狀態</p>
          </Link>
          <Link href="/account/profile" className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-green-300 transition-colors">
            <div className="text-3xl mb-1">✍️</div>
            <p className="font-bold text-gray-800">個人資料</p>
            <p className="text-[13px] text-gray-600 mt-0.5">姓名、手機、預設取貨門市</p>
          </Link>
          <Link href="/account/addresses" className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-green-300 transition-colors col-span-2">
            <div className="text-3xl mb-1">⭐</div>
            <p className="font-bold text-gray-800">常用收件資訊</p>
            <p className="text-[13px] text-gray-600 mt-0.5">管理下單時可快速選擇的收件人與門市</p>
          </Link>
        </div>

        {/* Link old orders prompt */}
        {profile?.phone && orders.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
            <p className="font-bold text-amber-900 text-sm mb-1">🔗 找回您的舊訂單</p>
            <p className="text-[13px] text-amber-700 leading-relaxed mb-3">
              如果您在註冊前曾用同一支手機號碼下過單，可以一鍵關聯到此會員帳號
            </p>
            <button onClick={linkOldOrders} disabled={linking}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors">
              {linking ? '查找中...' : '一鍵關聯舊訂單'}
            </button>
            {linkMessage && <p className="text-[13px] text-amber-800 mt-2">{linkMessage}</p>}
          </div>
        )}

        {/* Recent orders */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">最近訂單</h2>
            <Link href="/account/orders" className="text-green-700 text-sm font-bold hover:text-green-800">
              全部 →
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-gray-600 text-sm mb-4">還沒有訂單</p>
              <Link href="/" className="btn-primary inline-flex">去逛逛</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 3).map(o => (
                <div key={o.id} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[13px] text-gray-500 mb-0.5">{o.order_no}</p>
                    <p className="text-sm text-gray-700 truncate">{o.store_name}</p>
                    <p className="text-[13px] text-gray-600 mt-0.5">{formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`status-badge ${getStatusColor(o.order_status)}`}>{o.order_status}</span>
                    <p className="font-bold text-green-700 mt-1 text-sm">{formatPrice(o.total_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
