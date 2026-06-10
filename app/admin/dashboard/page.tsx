'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatPrice, formatDateTime } from '@/lib/utils'

export default function DashboardPage() {
  const [todayStats, setTodayStats] = useState<any>(null)
  const [monthStats, setMonthStats] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [hasReportAccess, setHasReportAccess] = useState(true)
  const [memberSummary, setMemberSummary] = useState<any>(null)
  const [trafficSummary, setTrafficSummary] = useState<any>(null)

  useEffect(() => {
    // Fetch today/month stats (may be 403 for some roles)
    fetch('/api/admin/reports?dateRange=today')
      .then(r => { if (r.status === 403) { setHasReportAccess(false); return null } return r.json() })
      .then(d => { if (d?.success) setTodayStats(d.data) })

    fetch('/api/admin/reports?dateRange=month')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success) setMonthStats(d.data) })

    // Always fetch recent orders
    fetch('/api/admin/orders?limit=5&page=1')
      .then(r => r.json())
      .then(d => { if (d.success) setRecentOrders(d.data) })

    // Member & traffic overview (super_admin only — silently ignored for others)
    fetch('/api/admin/members')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success) setMemberSummary(d.data.summary) })
      .catch(() => {})

    fetch('/api/admin/traffic?dateRange=today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success) setTrafficSummary(d.data.summary) })
      .catch(() => {})
  }, [])

  const pendingCount = todayStats?.status_stats?.find((s: any) => s.order_status === '待確認')?.count || 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">儀表板</h1>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <Link href="/admin/orders?status=待確認"
          className="flex items-center gap-4 mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 hover:bg-yellow-100 transition-colors">
          <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center text-2xl flex-shrink-0">🔔</div>
          <div>
            <p className="font-bold text-yellow-800 text-lg">有 {pendingCount} 筆待確認訂單</p>
            <p className="text-yellow-700 text-sm">點此前往處理</p>
          </div>
          <span className="ml-auto text-yellow-600 text-xl">→</span>
        </Link>
      )}

      {/* Stats cards */}
      {hasReportAccess && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: '今日訂單', value: todayStats?.summary.total_orders ?? '—', icon: '📦', bg: 'bg-blue-50 text-blue-700 border-blue-100', link: '/admin/orders?dateRange=today' },
            { label: '今日銷售額', value: todayStats ? formatPrice(todayStats.summary.total_revenue) : '—', icon: '💰', bg: 'bg-green-50 text-green-700 border-green-100', link: '/admin/reports' },
            { label: '本月訂單', value: monthStats?.summary.total_orders ?? '—', icon: '📊', bg: 'bg-purple-50 text-purple-700 border-purple-100', link: '/admin/orders?dateRange=month' },
            { label: '本月銷售額', value: monthStats ? formatPrice(monthStats.summary.total_revenue) : '—', icon: '📈', bg: 'bg-orange-50 text-orange-700 border-orange-100', link: '/admin/reports' },
          ].map(c => (
            <Link key={c.label} href={c.link} className={`card p-5 border hover:shadow-md transition-shadow ${c.bg}`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-xl font-bold">{c.value}</div>
              <div className="text-sm mt-1 opacity-80">{c.label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Member & traffic overview (super_admin only) */}
      {(memberSummary || trafficSummary) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: '會員總數', value: memberSummary?.total ?? '—', icon: '👤', bg: 'bg-teal-50 text-teal-700 border-teal-100', link: '/admin/members' },
            { label: '今日新增會員', value: memberSummary?.new_today ?? '—', icon: '🆕', bg: 'bg-cyan-50 text-cyan-700 border-cyan-100', link: '/admin/members' },
            { label: '今日瀏覽量', value: trafficSummary?.pv ?? '—', icon: '👁️', bg: 'bg-indigo-50 text-indigo-700 border-indigo-100', link: '/admin/traffic' },
            { label: '今日訪客數', value: trafficSummary?.uv ?? '—', icon: '🧑‍🤝‍🧑', bg: 'bg-pink-50 text-pink-700 border-pink-100', link: '/admin/traffic' },
          ].map(c => (
            <Link key={c.label} href={c.link} className={`card p-5 border hover:shadow-md transition-shadow ${c.bg}`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-xl font-bold">{c.value}</div>
              <div className="text-sm mt-1 opacity-80">{c.label}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-lg">最新訂單</h2>
            <Link href="/admin/orders" className="text-green-700 text-sm font-semibold hover:underline">查看全部 →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-gray-400 text-center py-8">暫無訂單</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o: any) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-50">
                  <div>
                    <p className="font-mono font-semibold text-gray-800 text-sm">{o.order_no}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{o.customer_name} · {formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      o.order_status === '待確認' ? 'bg-yellow-100 text-yellow-700' :
                      o.order_status === '已到店' ? 'bg-green-100 text-green-700' :
                      o.order_status === '已取消' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>{o.order_status}</span>
                    {hasReportAccess && <p className="text-green-700 font-bold text-sm mt-1">{formatPrice(o.total_amount)}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="font-bold text-gray-800 text-lg mb-4">快速操作</h2>
          <div className="space-y-3">
            {[
              { href: '/admin/orders', icon: '📦', label: '查看所有訂單', desc: '搜尋、篩選、更新狀態' },
              { href: '/admin/products/new', icon: '➕', label: '新增商品', desc: '新增保健品到商店' },
              { href: '/admin/products', icon: '🛍️', label: '商品庫存管理', desc: '查看庫存、編輯規格' },
              { href: '/admin/reports', icon: '📈', label: '查看銷售報表', desc: '訂單統計與分析' },
              { href: '/admin/members', icon: '👤', label: '會員管理', desc: '查看註冊會員與人數' },
              { href: '/admin/traffic', icon: '📡', label: '流量監控', desc: '瀏覽量、訪客與熱門頁面' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800">{item.label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
                </div>
                <span className="ml-auto text-gray-300">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
