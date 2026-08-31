/**
 * 把真實訂單資料去識別化，用在「最近有人預訂」的社群證明區塊。
 *
 * ⚠️ 這裡處理的是**真實顧客**的姓名與電話。
 *    這個檔案是唯一的遮罩來源，任何要對外顯示訂購人的地方都必須經過它。
 *    絕不要為了「看起來熱鬧」而放寬遮罩或改成產生假資料 ——
 *    假的購買訊息在台灣是《公平交易法》第 21 條的不實廣告。
 */

/**
 * 姓名遮罩：保留第一個字與最後一個字，中間全部換成 ＊。
 *
 *   陳如玉 → 陳＊玉
 *   王小明豪 → 王＊＊豪
 *   李明 → 李＊
 *   陳 → 陳＊（單字姓名補一個星號，避免直接露出完整內容）
 */
export function maskName(raw: string | null | undefined): string {
  const name = (raw || '').trim()
  if (!name) return '匿名'
  const chars = Array.from(name)
  if (chars.length === 1) return `${chars[0]}＊`
  if (chars.length === 2) return `${chars[0]}＊`
  return `${chars[0]}${'＊'.repeat(chars.length - 2)}${chars[chars.length - 1]}`
}

/**
 * 相對時間。刻意不給精確時間戳 ——
 * 「14:32 下單」加上遮罩後的姓名，認識的人就能對上是誰。
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.floor((now.getTime() - t) / 60000)

  if (mins < 0) return '剛剛'
  if (mins < 5) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`

  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return '一週前'
}

export interface RecentOrderRaw {
  customer_name: string | null
  created_at: string
}

/**
 * 對外只有姓名與時間。
 *
 * 電話刻意不在這裡出現 —— 遮罩過的手機（093****698）配上遮罩姓名，
 * 認識當事人的親友仍然對得出來，而它對「有人在買」這件事
 * 沒有增加任何說服力。不需要的個資就不要送出來。
 */
export interface RecentOrderPublic {
  name: string
  when: string
}

export function toPublicRecentOrder(
  row: RecentOrderRaw, now: Date = new Date(),
): RecentOrderPublic {
  return {
    name: maskName(row.customer_name),
    when: relativeTime(row.created_at, now),
  }
}

/**
 * 太舊的就不顯示。
 *
 * 「一個月前有人買」不會推動任何人現在下單，只會讓人覺得沒什麼人買。
 * 沒有近期訂單時寧可整個區塊不出現，也不要湊數。
 */
export const RECENT_WINDOW_DAYS = 14

export function isRecentEnough(
  iso: string, now: Date = new Date(), windowDays = RECENT_WINDOW_DAYS,
): boolean {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  const age = now.getTime() - t
  return age >= 0 && age <= windowDays * 86400_000
}
