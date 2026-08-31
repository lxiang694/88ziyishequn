/**
 * 決定預售彈窗要不要顯示 —— 純函式，可單元測試。
 *
 * 彈窗最容易做壞的地方不是動畫，是「什麼時候不該出現」：
 * 每頁都彈、關掉又彈、活動結束了還在彈，都會讓人直接離開。
 * 所以判斷邏輯放在這裡，元件只負責畫。
 */

export interface PopupDecisionInput {
  /** 設定檔的總開關 */
  enabled: boolean
  /** 現在時間 */
  now: Date
  /** 過了這天就不再顯示（YYYY-MM-DD）；空字串代表不設限 */
  hideAfter: string
  /** 上次顯示的時間戳（毫秒）；null 代表這個瀏覽器沒看過 */
  lastShownAt: number | null
  /** 關掉之後隔多久才會再出現 */
  cooldownHours: number
  /** 目前所在路徑 —— 已經在預售頁就不必再彈 */
  pathname: string
  /** 不再出現的路徑（預售頁本身、結帳流程等） */
  excludedPaths: readonly string[]
}

export type PopupSkipReason =
  | 'disabled'
  | 'expired'
  | 'cooldown'
  | 'excluded_path'
  | null

export function popupSkipReason(input: PopupDecisionInput): PopupSkipReason {
  if (!input.enabled) return 'disabled'

  if (input.hideAfter) {
    // 用當天結束（23:59:59）比較，才不會在最後一天就提早消失
    const end = new Date(`${input.hideAfter}T23:59:59+08:00`).getTime()
    if (!Number.isNaN(end) && input.now.getTime() > end) return 'expired'
  }

  // 結帳中或已經在預售頁的人，彈窗只會擋路
  if (input.excludedPaths.some(p => input.pathname === p || input.pathname.startsWith(`${p}/`))) {
    return 'excluded_path'
  }

  if (input.lastShownAt !== null) {
    const elapsed = input.now.getTime() - input.lastShownAt
    if (elapsed < input.cooldownHours * 3600_000) return 'cooldown'
  }

  return null
}

export function shouldShowPopup(input: PopupDecisionInput): boolean {
  return popupSkipReason(input) === null
}
