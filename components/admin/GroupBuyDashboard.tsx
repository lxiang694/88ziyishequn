'use client'

import Link from 'next/link'
import { formatTwDateTime, PHASE_LABEL, SHIPPING_SHORT, type Phase, type ShippingMethod } from '@/lib/groupBuy/domain'
import type { DashCampaign } from '@/lib/groupBuy/dashboard'

type Recent = {
  id: number; order_no: string; campaign_id: number; campaign_title: string; customer_name: string
  total_amount: number; status: string; shipping_method: ShippingMethod; created_at: string
}
export type GroupBuySummary = { campaigns: DashCampaign[]; pendingTotal: number; todayTotal: number; recent: Recent[] }

const money = (n: number) => `$${n.toLocaleString('zh-TW')}`
const PHASE_STYLE: Record<Phase, string> = {
  open: 'bg-red-100 text-red-700', upcoming: 'bg-amber-100 text-amber-800',
  closed: 'bg-slate-200 text-slate-700', draft: 'bg-gray-100 text-gray-600',
}
const STATUS_STYLE: Record<string, string> = {
  待出貨: 'bg-amber-100 text-amber-800', 已出貨: 'bg-blue-100 text-blue-800', 已完成: 'bg-green-100 text-green-800', 已取消: 'bg-gray-200 text-gray-600',
}
const ordersUrl = (campaignId: number, query = '') => `/admin/group-buy/${campaignId}/orders${query}`
const hm = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString()
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${d.slice(11, 16)}`
}

/**
 * 儀表板的團購區（資料由儀表板一起載入）：
 * 每一檔一列（訂單、金額、待出貨，點了進訂單與叫貨），下面是最新團購訂單。
 * 待出貨提醒放在儀表板最上方的「待辦」。
 */
export default function GroupBuyDashboard({ data }: { data: GroupBuySummary }) {
  return (
    <section aria-label="團購" className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          🧊 團購{data.todayTotal > 0 && <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[13px] font-semibold text-green-700">今日 +{data.todayTotal}</span>}
        </h2>
        <Link href="/admin/group-buy" className="text-sm font-semibold text-green-700 hover:underline">團購管理 →</Link>
      </div>

      {/* 檔期：一列一檔，整列可點 */}
      {data.campaigns.length > 0 && (
        <ul className="space-y-2">
          {data.campaigns.map(c => (
            <li key={c.id}>
              <Link href={ordersUrl(c.id)}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3 transition-colors hover:border-green-300 hover:bg-green-50/50">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2">
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${PHASE_STYLE[c.phase]}`}>{PHASE_LABEL[c.phase]}</span>
                    <span className="truncate font-bold text-gray-900">{c.title}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-gray-500">
                    {c.phase === 'upcoming' ? `${formatTwDateTime(c.starts_at)} 開團` : `${formatTwDateTime(c.ends_at)} 截單`}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-4 text-center sm:w-auto sm:justify-start">
                  <div><p className="text-[11px] text-gray-500">訂單</p><p className="font-bold text-gray-900 tabular-nums">{c.orders}</p></div>
                  <div><p className="text-[11px] text-gray-500">金額</p><p className="font-bold text-gray-900 tabular-nums">{money(c.revenue)}</p></div>
                  <div><p className="text-[11px] text-gray-500">待出貨</p><p className={`font-bold tabular-nums ${c.pending ? 'text-amber-700' : 'text-gray-300'}`}>{c.pending}</p></div>
                  <span className="text-lg text-green-700" aria-hidden>›</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* 最新團購訂單：點了打開那一檔的訂單頁並搜尋這筆 */}
      {data.recent.length > 0 && (
        <>
          <h3 className="mb-1 mt-5 text-sm font-bold text-gray-500">最新團購訂單</h3>
          <ul className="divide-y divide-gray-100">
            {data.recent.map(o => (
              <li key={o.id}>
                <Link href={ordersUrl(o.campaign_id, `?q=${encodeURIComponent(o.order_no)}`)}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-gray-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{o.customer_name}<span className="ml-1.5 text-[12px] font-normal text-gray-500">{SHIPPING_SHORT[o.shipping_method] || ''}</span></span>
                    <span className="block truncate text-[12px] text-gray-400"><span className="tabular-nums">{hm(o.created_at)}</span>・{o.campaign_title}</span>
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                  <span className="w-16 flex-shrink-0 text-right font-bold text-gray-900 tabular-nums">{money(o.total_amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
