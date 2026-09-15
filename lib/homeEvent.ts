/**
 * 首頁要不要顯示線下活動入口 —— 純函式，可單元測試。
 *
 * 原本首頁那塊「線下活動・開放報名」是無條件顯示的：不管有沒有活動、
 * 報名有沒有截止，都掛著一塊漸層色塊加閃爍紅點。沒活動的時候訪客點
 * 進去會看到空的，信任先扣一次；而且「開放報名」在沒東西可報名時，
 * 嚴格講是不實表示。
 *
 * 判斷條件只有兩個，兩個都要成立：
 *   1. 活動本身是啟用的（is_active）
 *   2. 報名還沒截止（沿用 isEventRegistrationClosed，與活動頁同一套規則）
 */

import { isEventRegistrationClosed } from './utils'

export interface HomeEventRow {
  slug: string
  title: string
  event_time: string | null
  is_active: boolean
  starts_at: string | null
}

/** 送到畫面的欄位；不含 is_active 與 starts_at 這些判斷用的原始值 */
export interface HomeEvent {
  slug: string
  title: string
  event_time: string | null
}

/**
 * 挑出要顯示的那一場。
 *
 * 同時只顯示一場 —— 首頁不是活動列表，想看全部的人會點進 /events。
 * 有多場開放時取「最快要開始」的那一場：那是報名期限最緊迫的。
 *
 * 沒有 starts_at 的活動排最後。這個欄位是後來才加的
 * （migrations/community_events_starts_at.sql），舊資料可能是空的，
 * 不該讓一場沒有日期的舊活動蓋過真的快要開始的新活動。
 */
export function pickOpenEvent(
  rows: readonly HomeEventRow[] | null | undefined,
  now: Date = new Date(),
): HomeEvent | null {
  const open = (rows || []).filter(
    r => r.is_active && !!r.slug && !isEventRegistrationClosed(r.starts_at, now),
  )
  if (open.length === 0) return null

  const sorted = open.slice().sort((a, b) => {
    const ta = a.starts_at ? new Date(a.starts_at).getTime() : Number.POSITIVE_INFINITY
    const tb = b.starts_at ? new Date(b.starts_at).getTime() : Number.POSITIVE_INFINITY
    if (ta !== tb) return ta - tb
    return a.slug.localeCompare(b.slug)
  })

  const { slug, title, event_time } = sorted[0]
  return { slug, title, event_time }
}
