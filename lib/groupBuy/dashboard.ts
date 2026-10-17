import { campaignPhase, type Phase } from './domain'

/**
 * 後台儀表板的團購摘要（純函式，可測試）。
 *
 * 要放上儀表板的檔期：開團中、預告中，以及還有「待出貨」訂單的
 * （截單或關閉後還沒出完貨的，最容易被忘記）。
 */
export interface DashCampaignRow { id: number; slug: string; title: string; starts_at: string; ends_at: string; is_published: boolean }
export interface DashOrderRow { campaign_id: number; total_amount: number; status: string; created_at: string }

export interface DashCampaign extends DashCampaignRow {
  phase: Phase; orders: number; revenue: number; pending: number; today: number
}

/** 台灣時間今天 00:00 的 UTC 時間 */
export function twTodayStart(now = new Date()): Date {
  const tw = new Date(now.getTime() + 8 * 3600_000)
  return new Date(Date.UTC(tw.getUTCFullYear(), tw.getUTCMonth(), tw.getUTCDate()) - 8 * 3600_000)
}

const PHASE_ORDER: Record<Phase, number> = { open: 0, upcoming: 1, closed: 2, draft: 3 }

export function summarizeGroupBuy(campaigns: DashCampaignRow[], orders: DashOrderRow[], now = new Date()) {
  const today = twTodayStart(now).getTime()
  const stats = new Map<number, { orders: number; revenue: number; pending: number; today: number }>()
  for (const o of orders) {
    if (o.status === '已取消') continue
    const s = stats.get(o.campaign_id) || { orders: 0, revenue: 0, pending: 0, today: 0 }
    s.orders++; s.revenue += o.total_amount
    if (o.status === '待出貨') s.pending++
    if (new Date(o.created_at).getTime() >= today) s.today++
    stats.set(o.campaign_id, s)
  }
  const list: DashCampaign[] = campaigns
    .map(c => ({ ...c, phase: campaignPhase(c, now), ...(stats.get(c.id) || { orders: 0, revenue: 0, pending: 0, today: 0 }) }))
    .filter(c => c.phase === 'open' || c.phase === 'upcoming' || c.pending > 0)
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]
      || (a.phase === 'upcoming' ? a.starts_at.localeCompare(b.starts_at) : a.ends_at.localeCompare(b.ends_at)))
  return {
    campaigns: list,
    pendingTotal: list.reduce((n, c) => n + c.pending, 0),
    todayTotal: list.reduce((n, c) => n + c.today, 0),
  }
}
