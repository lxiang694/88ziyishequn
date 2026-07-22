// 客戶分層（RFM）共用邏輯 — 復購分析與趨勢分析共用
export const DAY_MS = 24 * 60 * 60 * 1000
export const DORMANT_DAYS = 60
export const LOST_DAYS = 180
export const VIP_MIN_ORDERS = 3

export type Segment = 'vip' | 'lost' | 'dormant' | 'repeat' | 'new'

export const SEGMENT_LABEL: Record<Segment, string> = {
  vip: 'VIP',
  lost: '流失客',
  dormant: '沉睡客',
  repeat: '回頭客',
  new: '新客',
}

export function classify(orderCount: number, daysSinceLast: number): Segment {
  if (orderCount >= VIP_MIN_ORDERS && daysSinceLast <= DORMANT_DAYS) return 'vip'
  if (daysSinceLast > LOST_DAYS) return 'lost'
  if (daysSinceLast > DORMANT_DAYS) return 'dormant'
  if (orderCount >= 2) return 'repeat'
  return 'new'
}

// 台灣時間（UTC+8）的日期字串 YYYY-MM-DD / 月份 YYYY-MM
export function twDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
export function twMonth(iso: string): string {
  return twDate(iso).slice(0, 7)
}

// 在某時間點 refTime 當下，各分層（含 dormant / lost）的客戶數
export function segmentCountsAsOf(
  orders: { phone: string | null; created_at: string }[],
  refTime: number
): { dormant: number; lost: number } {
  const m = new Map<string, { count: number; last: number }>()
  for (const o of orders) {
    const t = new Date(o.created_at).getTime()
    if (t > refTime) continue
    const phone = (o.phone || '').trim()
    if (!phone) continue
    const a = m.get(phone)
    if (!a) m.set(phone, { count: 1, last: t })
    else { a.count++; if (t > a.last) a.last = t }
  }
  let dormant = 0, lost = 0
  for (const a of m.values()) {
    const days = Math.floor((refTime - a.last) / DAY_MS)
    const seg = classify(a.count, days)
    if (seg === 'dormant') dormant++
    else if (seg === 'lost') lost++
  }
  return { dormant, lost }
}
