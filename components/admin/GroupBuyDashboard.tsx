'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { formatTwDateTime, PHASE_LABEL, SHIPPING_SHORT, type Phase, type ShippingMethod } from '@/lib/groupBuy/domain'
import type { DashCampaign } from '@/lib/groupBuy/dashboard'

type Recent = {
  id: number; order_no: string; campaign_id: number; campaign_title: string; customer_name: string
  total_amount: number; status: string; shipping_method: ShippingMethod; created_at: string
}
type Summary = { campaigns: DashCampaign[]; pendingTotal: number; todayTotal: number; recent: Recent[] }

const money = (n: number) => `$${n.toLocaleString('zh-TW')}`
const PHASE_STYLE: Record<Phase, string> = {
  open: 'bg-red-100 text-red-700', upcoming: 'bg-amber-100 text-amber-800',
  closed: 'bg-slate-200 text-slate-700', draft: 'bg-gray-100 text-gray-600',
}
const STATUS_STYLE: Record<string, string> = {
  待出貨: 'bg-amber-100 text-amber-800', 已出貨: 'bg-blue-100 text-blue-800', 已完成: 'bg-green-100 text-green-800', 已取消: 'bg-gray-200 text-gray-600',
}
const ordersUrl = (campaignId: number, query = '') => `/admin/group-buy/${campaignId}/orders${query}`

/**
 * 儀表板上的團購區：待出貨提醒、需要注意的檔期、最新團購訂單。
 * 沒有團購權限（API 回 403）或還沒有任何團購時整區不顯示。
 */
export default function GroupBuyDashboard() {
  const [data, setData] = useState<Summary | null>(null)
  useEffect(() => {
    fetch('/api/admin/group-buy/dashboard', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.success) setData(d.data) })
      .catch(() => {})
  }, [])

  if (!data || (data.campaigns.length === 0 && data.recent.length === 0)) return null
  // 只有一檔有待出貨：提醒直接帶到那一檔的待出貨清單
  const pendingCampaigns = data.campaigns.filter(c => c.pending > 0)
  const pendingHref = pendingCampaigns.length === 1 ? ordersUrl(pendingCampaigns[0].id, '?status=待出貨') : '/admin/group-buy'

  return (
    <section className="mb-8" aria-label="團購">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">🧊 團購{data.todayTotal > 0 && <span className="ml-2 text-sm font-semibold text-green-700">今日 {data.todayTotal} 筆新訂單</span>}</h2>
        <Link href="/admin/group-buy" className="text-sm font-semibold text-green-700 hover:underline">團購管理 →</Link>
      </div>

      {data.pendingTotal > 0 && (
        <Link href={pendingHref}
          className="mb-4 flex items-center gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 transition-colors hover:bg-amber-100">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-2xl">🚚</div>
          <div>
            <p className="text-lg font-bold text-amber-900">有 {data.pendingTotal} 筆團購訂單待出貨</p>
            <p className="text-sm text-amber-800">{pendingCampaigns.map(c => `${c.title} ${c.pending} 筆`).join('、')}</p>
          </div>
          <span className="ml-auto text-xl text-amber-700">→</span>
        </Link>
      )}

      {/* 檔期卡片：整張可點，進入那一檔的訂單與叫貨 */}
      {data.campaigns.length > 0 && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {data.campaigns.map(c => (
            <Link key={c.id} href={ordersUrl(c.id)} className="card group block p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start gap-2">
                <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${PHASE_STYLE[c.phase]}`}>{PHASE_LABEL[c.phase]}</span>
                <p className="min-w-0 font-bold leading-snug text-gray-900">{c.title}</p>
              </div>
              <p className="mt-1 text-[13px] text-gray-500">
                {c.phase === 'upcoming' ? `${formatTwDateTime(c.starts_at)} 開團` : `${formatTwDateTime(c.ends_at)} 截單`}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 py-2"><dt className="text-xs text-gray-500">訂單</dt><dd className="text-lg font-bold text-gray-900">{c.orders}</dd></div>
                <div className="rounded-xl bg-gray-50 py-2"><dt className="text-xs text-gray-500">金額</dt><dd className="text-lg font-bold text-gray-900">{money(c.revenue)}</dd></div>
                <div className={`rounded-xl py-2 ${c.pending ? 'bg-amber-50' : 'bg-gray-50'}`}><dt className="text-xs text-gray-500">待出貨</dt><dd className={`text-lg font-bold ${c.pending ? 'text-amber-700' : 'text-gray-400'}`}>{c.pending}</dd></div>
              </dl>
              <p className="mt-3 text-right text-sm font-bold text-green-700 group-hover:underline">訂單與叫貨 →</p>
            </Link>
          ))}
        </div>
      )}

      {/* 最新團購訂單：點了直接在那一檔的訂單頁搜尋這筆 */}
      {data.recent.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-3 font-bold text-gray-800">最新團購訂單</h3>
          <div className="space-y-2">
            {data.recent.map(o => (
              <Link key={o.id} href={ordersUrl(o.campaign_id, `?q=${encodeURIComponent(o.order_no)}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-50 p-3 transition-colors hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-gray-800">{o.order_no}</p>
                  <p className="mt-0.5 truncate text-[13px] text-gray-500">{o.customer_name} · {SHIPPING_SHORT[o.shipping_method] || ''} · {formatDateTime(o.created_at)}</p>
                  <p className="truncate text-[12px] text-gray-400">{o.campaign_title}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`rounded-full px-2 py-1 text-[13px] font-bold ${STATUS_STYLE[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                  <p className="mt-1 text-sm font-bold text-green-700">{money(o.total_amount)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
