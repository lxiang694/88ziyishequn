/**
 * 客戶經營（純函式，可測試）。
 *
 * 一般訂單與團購訂單依「手機」合併成同一位客人 —— 只跟團的客人以前在
 * 復購分析裡看不到，會被誤判成流失。
 *
 * 客人狀態（距離上次購買）：
 *   活躍   30 天內買過
 *   穩定   31～60 天
 *   沉睡   61～180 天   → 值得主動聯繫
 *   流失   180 天以上    → 用優惠或新品喚回
 * 另外「該回購了」：依這位客人自己的回購週期（只買過一次的用全站平均），
 * 已經超過預計回購日、但還沒流失 —— 最值得今天就聯繫的人。
 */
export const DAY_MS = 86_400_000

export type CustomerStatus = 'active' | 'steady' | 'dormant' | 'lost'
export const STATUS_LABEL: Record<CustomerStatus, string> = {
  active: '活躍', steady: '穩定', dormant: '沉睡', lost: '流失',
}

export interface CustomerOrder {
  phone: string | null
  customer_name: string | null
  line_id?: string | null
  total_amount: number
  created_at: string
  source: 'shop' | 'group_buy'
  items: string[]
}

export interface Customer {
  phone: string
  name: string
  line_id: string
  orders: number
  group_buy_orders: number
  spend: number
  /** 近 90 天消費 */
  spend_90d: number
  first_at: string
  last_at: string
  days_since: number
  /** 平均幾天回購一次；只買過一次是 null */
  cycle_days: number | null
  /** 預計下次回購日已經過了幾天（負數＝還沒到） */
  overdue_days: number | null
  status: CustomerStatus
  due: boolean
  last_items: string[]
  favorite_items: string[]
}

/** 手機統一成 09xxxxxxxx；格式不對的不算（無法辨識是誰） */
export function normalizePhone(p: string | null | undefined): string | null {
  const digits = (p || '').replace(/\D/g, '').replace(/^8869/, '09')
  return /^09\d{8}$/.test(digits) ? digits : null
}

export function statusOf(daysSince: number): CustomerStatus {
  if (daysSince <= 30) return 'active'
  if (daysSince <= 60) return 'steady'
  if (daysSince <= 180) return 'dormant'
  return 'lost'
}

export function buildCustomers(orders: CustomerOrder[], now = Date.now()): { customers: Customer[]; globalCycle: number | null } {
  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const groups = new Map<string, CustomerOrder[]>()
  for (const o of sorted) {
    const phone = normalizePhone(o.phone)
    if (!phone) continue
    const list = groups.get(phone)
    if (list) list.push(o)
    else groups.set(phone, [o])
  }

  const since90 = now - 90 * DAY_MS
  const draft = [...groups.entries()].map(([phone, list]) => {
    const first = list[0]
    const last = list[list.length - 1]
    const lastTime = new Date(last.created_at).getTime()
    const counts = new Map<string, number>()
    for (const o of list) for (const name of o.items) counts.set(name, (counts.get(name) || 0) + 1)
    const span = (lastTime - new Date(first.created_at).getTime()) / DAY_MS
    return {
      phone,
      name: [...list].reverse().find(o => o.customer_name)?.customer_name?.trim() || '',
      line_id: [...list].reverse().find(o => o.line_id)?.line_id?.trim() || '',
      orders: list.length,
      group_buy_orders: list.filter(o => o.source === 'group_buy').length,
      spend: Math.round(list.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)),
      spend_90d: Math.round(list.filter(o => new Date(o.created_at).getTime() >= since90).reduce((s, o) => s + (Number(o.total_amount) || 0), 0)),
      first_at: first.created_at,
      last_at: last.created_at,
      days_since: Math.max(0, Math.floor((now - lastTime) / DAY_MS)),
      cycle_days: list.length >= 2 ? Math.max(1, Math.round(span / (list.length - 1))) : null,
      last_items: [...new Set(last.items)].slice(0, 3),
      favorite_items: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
    }
  })

  const cycles = draft.map(c => c.cycle_days).filter((d): d is number => d !== null)
  const globalCycle = cycles.length ? Math.round(cycles.reduce((s, d) => s + d, 0) / cycles.length) : null

  const customers: Customer[] = draft.map(c => {
    const cycle = c.cycle_days ?? globalCycle
    const overdue = cycle ? c.days_since - cycle : null
    const status = statusOf(c.days_since)
    return { ...c, overdue_days: overdue, status, due: overdue !== null && overdue > 0 && status !== 'lost' }
  })
  return { customers, globalCycle }
}

export interface CrmSummary {
  customers: number
  repeat_customers: number
  repeat_rate: number
  status: Record<CustomerStatus, { count: number; spend: number }>
  due: number
  one_time_dormant: number
  /** 前 20% 客人貢獻多少營收 */
  core_count: number
  core_share: number
  revenue: number
  revenue_90d: number
  /** 近 90 天營收裡，老客（買過 2 次以上）占多少 */
  returning_share_90d: number
  global_cycle: number | null
}

export function summarizeCustomers(customers: Customer[], globalCycle: number | null): CrmSummary {
  const status = { active: { count: 0, spend: 0 }, steady: { count: 0, spend: 0 }, dormant: { count: 0, spend: 0 }, lost: { count: 0, spend: 0 } }
  for (const c of customers) { status[c.status].count++; status[c.status].spend += c.spend }
  const revenue = customers.reduce((s, c) => s + c.spend, 0)
  const revenue90 = customers.reduce((s, c) => s + c.spend_90d, 0)
  const bySpend = [...customers].sort((a, b) => b.spend - a.spend)
  const coreCount = Math.max(customers.length ? 1 : 0, Math.ceil(customers.length * 0.2))
  const coreSpend = bySpend.slice(0, coreCount).reduce((s, c) => s + c.spend, 0)
  const repeat = customers.filter(c => c.orders >= 2)
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
  return {
    customers: customers.length,
    repeat_customers: repeat.length,
    repeat_rate: pct(repeat.length, customers.length),
    status,
    due: customers.filter(c => c.due).length,
    one_time_dormant: customers.filter(c => c.orders === 1 && (c.status === 'dormant' || c.status === 'lost')).length,
    core_count: coreCount,
    core_share: pct(coreSpend, revenue),
    revenue,
    revenue_90d: revenue90,
    returning_share_90d: pct(repeat.reduce((s, c) => s + c.spend_90d, 0), revenue90),
    global_cycle: globalCycle,
  }
}

/** 名單分類（後台頁籤） */
export type ListKey = 'core' | 'due' | 'dormant' | 'lost' | 'one_time' | 'all'

export function filterList(customers: Customer[], key: ListKey): Customer[] {
  switch (key) {
    case 'core': return [...customers].sort((a, b) => b.spend - a.spend).slice(0, Math.max(1, Math.ceil(customers.length * 0.2)))
    case 'due': return customers.filter(c => c.due).sort((a, b) => b.spend - a.spend)
    case 'dormant': return customers.filter(c => c.status === 'dormant').sort((a, b) => b.spend - a.spend)
    case 'lost': return customers.filter(c => c.status === 'lost').sort((a, b) => b.spend - a.spend)
    case 'one_time': return customers.filter(c => c.orders === 1 && c.days_since > 30).sort((a, b) => a.days_since - b.days_since)
    default: return [...customers].sort((a, b) => b.spend - a.spend)
  }
}

/** 稱呼：王小明 → 小明；兩個字以下直接用全名 */
export function callName(name: string): string {
  const chars = Array.from(name.trim())
  if (!chars.length) return '您'
  if (/^[A-Za-z]/.test(name)) return name.trim().split(/\s+/)[0]
  return chars.length >= 3 ? chars.slice(1).join('') : chars.join('')
}

/**
 * 一對一 LINE 訊息草稿（後台按「複製」後貼到 LINE 聊天）。
 * 依名單用不同語氣；附商城連結並帶 utm 標記，流量來源裡看得到成效。
 */
export function winBackMessage(c: Customer, key: ListKey, siteUrl: string): string {
  const who = callName(c.name)
  const item = c.favorite_items[0] || c.last_items[0]
  const link = `${siteUrl}/?utm_source=line&utm_medium=winback&utm_campaign=${key}`
  const lines: string[] = []
  if (key === 'core') {
    lines.push(`${who}您好 😊 謝謝您一直以來的支持！`)
    if (item) lines.push(`常買的「${item}」最近補貨了，需要的話跟我說一聲，我幫您先留。`)
    lines.push('有新品或團購也會第一時間通知您 🙏')
  } else if (key === 'due') {
    lines.push(`${who}您好 😊`)
    lines.push(item ? `上次買的「${item}」算算時間差不多快用完了，要不要幫您再準備一份？` : '算算時間上次買的應該差不多快用完了，要不要幫您再準備一份？')
    lines.push('直接回覆我數量就可以，一樣 7-11 取貨付款 👍')
  } else if (key === 'dormant') {
    lines.push(`${who}您好，好久不見 😊`)
    lines.push(item ? `之前您買過「${item}」，用起來還習慣嗎？` : '之前跟我們買的商品用起來還習慣嗎？')
    lines.push('最近店裡多了不少新品，有空可以逛逛看，有任何問題都可以直接問我喔！')
  } else if (key === 'lost') {
    lines.push(`${who}您好，好久沒跟您聯繫了 😊`)
    lines.push('這段時間店裡上架了不少新品，也開了每月團購。')
    lines.push('想跟您分享一下，有興趣可以看看，有需要隨時跟我說 🙏')
  } else {
    lines.push(`${who}您好 😊 謝謝您上次的訂購！`)
    lines.push(item ? `「${item}」用起來還可以嗎？有任何使用上的問題都可以問我。` : '商品用起來還可以嗎？有任何使用上的問題都可以問我。')
    lines.push('之後有新品或團購會再通知您 🙏')
  }
  lines.push('', `👉 ${link}`)
  return lines.join('\n')
}

/** 聯繫之後有沒有回來買：之後有新訂單＝挽回成功；30 天內還在等；超過 30 天沒動靜＝沒回應 */
export function contactOutcome(lastOrderAt: string, contactedAt: string, now = Date.now()): 'won' | 'waiting' | 'no_response' {
  const contacted = new Date(contactedAt).getTime()
  if (new Date(lastOrderAt).getTime() > contacted) return 'won'
  return now - contacted <= 30 * DAY_MS ? 'waiting' : 'no_response'
}
