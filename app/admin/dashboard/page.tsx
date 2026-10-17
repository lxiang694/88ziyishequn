'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import GroupBuyDashboard, { type GroupBuySummary } from '@/components/admin/GroupBuyDashboard'

/**
 * 後台儀表板。由上而下照「先處理什麼」排：
 *   1. 待辦：待確認訂單、團購待出貨 —— 一進來就知道要做什麼，點了直接到清單
 *   2. 今日／本月數字（今日跟昨天比）
 *   3. 最新訂單、團購（左）＋ 快速操作、網站概況（右）
 * 手機上快速操作排在數字後面，常用功能一滑就到。
 */

type Me = { name: string; permissions: string[] }
type Stats = { summary: { total_orders: number; total_revenue: number } }
type RecentOrder = { id: number; order_no: string; customer_name: string; order_status: string; total_amount: number; created_at: string }

const ORDER_STATUS_STYLE: Record<string, string> = {
  待確認: 'bg-yellow-100 text-yellow-800', 已確認: 'bg-blue-100 text-blue-800', 備貨中: 'bg-purple-100 text-purple-800',
  已出貨: 'bg-indigo-100 text-indigo-800', 已到店: 'bg-green-100 text-green-800', 已完成: 'bg-green-100 text-green-800', 已取消: 'bg-gray-200 text-gray-600',
}

// 和側邊選單同一套權限：看不到的功能就不放捷徑
const QUICK_ACTIONS = [
  { href: '/admin/quick-order', icon: '⚡', label: '快速下單', perms: ['orders.create'] },
  { href: '/admin/orders', icon: '📦', label: '訂單管理', perms: ['orders.view', 'orders.status', 'orders.status.ship', 'orders.edit'] },
  { href: '/admin/group-buy', icon: '🧊', label: '團購管理', perms: ['group_buy.manage'] },
  { href: '/admin/myship', icon: '🚚', label: '賣貨便轉單', perms: ['orders.transfer'] },
  { href: '/admin/products/new', icon: '➕', label: '新增商品', perms: ['products.all'] },
  { href: '/admin/products', icon: '🛍️', label: '商品庫存', perms: ['products.all'] },
  { href: '/admin/reports', icon: '📈', label: '銷售報表', perms: ['orders.view'] },
  { href: '/admin/members', icon: '👤', label: '會員管理', perms: [] },
  { href: '/admin/traffic', icon: '📡', label: '流量監控', perms: [] },
]
const can = (me: Me | null, perms: string[]) =>
  !!me && (me.permissions.includes('all') || perms.some(p => me.permissions.includes(p)))

/** 台灣時間：問候語與日期 */
function twNow() {
  const d = new Date(Date.now() + 8 * 3600_000)
  const h = d.getUTCHours()
  return {
    greeting: h >= 5 && h < 11 ? '早安' : h >= 11 && h < 18 ? '午安' : '晚上好',
    date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${'日一二三四五六'[d.getUTCDay()]}）`,
    today: d.toISOString().slice(0, 10),
  }
}
/** 今天的訂單只顯示時間，以前的顯示日期 */
function shortTime(iso: string, today: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString()
  return d.slice(0, 10) === today ? d.slice(11, 16) : `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${d.slice(11, 16)}`
}
const json = (url: string) => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [today, setToday] = useState<Stats | null>(null)
  const [yesterday, setYesterday] = useState<Stats | null>(null)
  const [month, setMonth] = useState<Stats | null>(null)
  const [hasReportAccess, setHasReportAccess] = useState(true)
  const [recent, setRecent] = useState<RecentOrder[] | null>(null)
  const [pendingOrders, setPendingOrders] = useState<number | null>(null)
  const [groupBuy, setGroupBuy] = useState<GroupBuySummary | null>(null)
  const [members, setMembers] = useState<{ total: number; new_today: number } | null>(null)
  const [traffic, setTraffic] = useState<{ pv: number; uv: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [meR, todayR, yR, monthR, recentR, pendingR, gbR, memR, trR] = await Promise.all([
      json('/api/admin/auth/me'),
      fetch('/api/admin/reports?dateRange=today', { cache: 'no-store' }).then(r => {
        if (r.status === 403) { setHasReportAccess(false); return null }
        return r.ok ? r.json() : null
      }).catch(() => null),
      json('/api/admin/reports?dateRange=yesterday'),
      json('/api/admin/reports?dateRange=month'),
      json('/api/admin/orders?limit=6&page=1'),
      // 全部待確認（不限日期）：以前只算今天的，前幾天沒處理的會被漏掉
      json(`/api/admin/orders?status=${encodeURIComponent('待確認')}&limit=1&page=1`),
      json('/api/admin/group-buy/dashboard'),
      json('/api/admin/members'),
      json('/api/admin/traffic?dateRange=today'),
    ])
    if (meR?.success) setMe(meR.data)
    if (todayR?.success) setToday(todayR.data)
    if (yR?.success) setYesterday(yR.data)
    if (monthR?.success) setMonth(monthR.data)
    if (recentR?.success) setRecent(recentR.data); else setRecent(r => r ?? [])
    if (pendingR?.success) setPendingOrders(pendingR.total ?? 0)
    if (gbR?.success) setGroupBuy(gbR.data)
    if (memR?.success) setMembers(memR.data.summary)
    if (trR?.success) setTraffic(trR.data.summary)
    setUpdatedAt(new Date(Date.now() + 8 * 3600_000).toISOString().slice(11, 16))
    setLoading(false)
  }, [])

  // 進來時載入；切回這個分頁時自動更新（看訂單時常常切去別的視窗）
  useEffect(() => {
    load()
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [load])

  const tw = twNow()
  const gbPending = groupBuy?.pendingTotal ?? 0
  const gbPendingCampaigns = groupBuy?.campaigns.filter(c => c.pending > 0) ?? []
  const gbPendingHref = gbPendingCampaigns.length === 1
    ? `/admin/group-buy/${gbPendingCampaigns[0].id}/orders?status=${encodeURIComponent('待出貨')}` : '/admin/group-buy'
  const todos = [
    pendingOrders ? { href: `/admin/orders?status=${encodeURIComponent('待確認')}`, icon: '🔔', label: '待確認訂單', count: pendingOrders } : null,
    gbPending ? { href: gbPendingHref, icon: '🚚', label: '團購待出貨', count: gbPending } : null,
  ].filter(Boolean) as { href: string; icon: string; label: string; count: number }[]
  const todosReady = pendingOrders !== null

  const diff = (a?: number, b?: number) => (a == null || b == null ? null : a - b)
  const orderDiff = diff(today?.summary.total_orders, yesterday?.summary.total_orders)
  const kpis = [
    { label: '今日訂單', value: today ? String(today.summary.total_orders) : '—', icon: '📦', tone: 'bg-blue-50 text-blue-700', href: '/admin/orders?dateRange=today',
      sub: orderDiff == null ? '' : orderDiff === 0 ? '和昨天一樣' : `比昨天 ${orderDiff > 0 ? '↑' : '↓'}${Math.abs(orderDiff)} 筆` },
    { label: '今日營業額', value: today ? formatPrice(today.summary.total_revenue) : '—', icon: '💰', tone: 'bg-green-50 text-green-700', href: '/admin/reports',
      sub: yesterday ? `昨天 ${formatPrice(yesterday.summary.total_revenue)}` : '' },
    { label: '本月訂單', value: month ? String(month.summary.total_orders) : '—', icon: '📊', tone: 'bg-purple-50 text-purple-700', href: '/admin/orders?dateRange=month', sub: '' },
    { label: '本月營業額', value: month ? formatPrice(month.summary.total_revenue) : '—', icon: '📈', tone: 'bg-orange-50 text-orange-700', href: '/admin/reports', sub: '' },
  ]
  // perms 是空陣列的（會員、流量）只有超級管理員（all）看得到
  const actions = QUICK_ACTIONS.filter(a => can(me, a.perms))

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── 問候、日期、重新整理 ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{tw.date}</p>
          <h1 className="text-2xl font-bold text-gray-900">{tw.greeting}{me?.name ? `，${me.name}` : ''}</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-green-500 disabled:opacity-50">
          <span className={loading ? 'animate-spin' : ''} aria-hidden>↻</span>
          {loading ? '更新中…' : updatedAt ? `${updatedAt} 更新` : '重新整理'}
        </button>
      </div>

      {/* ── 待辦 ── */}
      <section aria-label="待辦" className="mb-6">
        {!todosReady ? (
          <div className="h-[68px] animate-pulse rounded-2xl bg-white" />
        ) : todos.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3.5 text-green-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white" aria-hidden>✓</span>
            <p className="font-bold">目前沒有待處理的訂單</p>
          </div>
        ) : (
          <div className={`grid gap-3 ${todos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {todos.map(t => (
              <Link key={t.label} href={t.href}
                className="flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-xl" aria-hidden>{t.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-amber-800">{t.label}</span>
                  <span className="block text-2xl font-extrabold leading-tight text-amber-900 tabular-nums">{t.count} <span className="text-base font-bold">筆</span></span>
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-amber-800 shadow-sm">去處理 →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 今日／本月數字 ── */}
      {hasReportAccess && (
        <section aria-label="營業數字" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(k => (
            // 圖示和標籤同一行、數字獨佔一行：手機上金額不會被擠成「NT$5,…」
            <Link key={k.label} href={k.href} className="card group block p-4 transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2">
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base ${k.tone}`} aria-hidden>{k.icon}</span>
                <span className="text-[13px] font-semibold text-gray-500">{k.label}</span>
              </span>
              <span className="mt-2 block text-[22px] font-bold leading-tight text-gray-900 tabular-nums">{k.value}</span>
              <span className="block min-h-[18px] text-[12px] text-gray-500">{k.sub}</span>
            </Link>
          ))}
        </section>
      )}

      {/* ── 主要區塊：手機依序為 快速操作 → 最新訂單 → 團購 → 網站概況 ── */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* 快速操作 */}
        <section aria-label="快速操作" className="card p-4 lg:col-start-3 lg:row-start-1">
          <h2 className="mb-3 font-bold text-gray-800">快速操作</h2>
          <div className="grid grid-cols-3 gap-2">
            {(me ? actions : QUICK_ACTIONS.slice(0, 6)).map(a => (
              <Link key={a.href} href={a.href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-1 py-3 text-center transition-colors hover:border-green-400 hover:bg-green-50 ${me ? '' : 'pointer-events-none opacity-40'}`}>
                <span className="text-2xl leading-none" aria-hidden>{a.icon}</span>
                <span className="text-[13px] font-semibold leading-tight text-gray-800">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 最新訂單 */}
        <section aria-label="最新訂單" className="card p-5 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">最新訂單</h2>
            <Link href="/admin/orders" className="text-sm font-semibold text-green-700 hover:underline">全部訂單 →</Link>
          </div>
          {recent === null ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-50" />)}</div>
          ) : recent.length === 0 ? (
            <p className="py-8 text-center text-gray-500">暫無訂單</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map(o => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50">
                    <span className="w-12 flex-shrink-0 text-[13px] font-semibold text-gray-500 tabular-nums">{shortTime(o.created_at, tw.today)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900">{o.customer_name}</span>
                      <span className="block truncate font-mono text-[12px] text-gray-400">{o.order_no}</span>
                    </span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${ORDER_STATUS_STYLE[o.order_status] || 'bg-gray-100 text-gray-600'}`}>{o.order_status}</span>
                    {hasReportAccess && <span className="w-20 flex-shrink-0 text-right font-bold text-gray-900 tabular-nums">{formatPrice(o.total_amount)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 團購（沒有團購權限或還沒有團購時不顯示） */}
        {groupBuy && (groupBuy.campaigns.length > 0 || groupBuy.recent.length > 0) && (
          <div className="lg:col-span-2 lg:col-start-1">
            <GroupBuyDashboard data={groupBuy} />
          </div>
        )}

        {/* 網站概況（超級管理員） */}
        {(members || traffic) && (
          <section aria-label="網站概況" className="card p-4 lg:col-start-3 lg:row-start-2">
            <h2 className="mb-2 font-bold text-gray-800">網站概況</h2>
            <div className="divide-y divide-gray-100 text-sm">
              {[
                { label: '今日瀏覽量', value: traffic?.pv, href: '/admin/traffic' },
                { label: '今日訪客', value: traffic?.uv, href: '/admin/traffic' },
                { label: '今日新會員', value: members?.new_today, href: '/admin/members' },
                { label: '會員總數', value: members?.total, href: '/admin/members' },
              ].map(r => (
                <Link key={r.label} href={r.href} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-gray-50">
                  <span className="text-gray-600">{r.label}</span>
                  <span className="font-bold text-gray-900 tabular-nums">{r.value?.toLocaleString('zh-TW') ?? '—'}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
