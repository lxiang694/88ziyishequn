/**
 * 前台彈窗的挑選邏輯 —— 純函式，可單元測試。
 *
 * 「什麼時候不該出現」比「怎麼出現」重要得多：
 * 每頁都彈、關掉又彈、活動結束還在彈，都會讓人直接離開。
 */

export interface PopupRow {
  id: number
  name: string
  badge_text: string | null
  title: string
  body: string | null
  price_text: string | null
  image_url: string | null
  cta_text: string
  link_path: string
  product_slug: string | null
  is_active: boolean
  priority: number
  delay_ms: number
  auto_close_ms: number
  cooldown_hours: number
  starts_at: string | null
  ends_at: string | null
  include_paths: string[]
  exclude_paths: string[]
}

/** 送到瀏覽器的欄位；不含後台自用的 name 與時間戳 */
export interface PopupPublic {
  id: number
  badge_text: string | null
  title: string
  body: string | null
  price_text: string | null
  image_url: string | null
  cta_text: string
  link_path: string
  product_slug: string | null
  delay_ms: number
  auto_close_ms: number
  cooldown_hours: number
}

export function toPublicPopup(r: PopupRow): PopupPublic {
  return {
    id: r.id,
    badge_text: r.badge_text,
    title: r.title,
    body: r.body,
    price_text: r.price_text,
    image_url: r.image_url,
    cta_text: r.cta_text,
    link_path: r.link_path,
    product_slug: r.product_slug,
    delay_ms: r.delay_ms,
    auto_close_ms: r.auto_close_ms,
    cooldown_hours: r.cooldown_hours,
  }
}

/** 台灣日期字串（YYYY-MM-DD） */
export function twToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10)
}

/**
 * 期間比較用日期字串，避免時區把最後一天提早砍掉。
 * starts_at 當天 00:00 起算，ends_at 當天 23:59 才結束。
 */
export function isWithinWindow(
  row: Pick<PopupRow, 'starts_at' | 'ends_at'>, now: Date = new Date(),
): boolean {
  const today = twToday(now)
  if (row.starts_at && today < row.starts_at) return false
  if (row.ends_at && today > row.ends_at) return false
  return true
}

/** 路徑是否命中清單（完全相同或是其子路徑） */
export function pathMatches(pathname: string, list: readonly string[]): boolean {
  return list.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export function isPathAllowed(row: PopupRow, pathname: string): boolean {
  // 已經在目的地頁面就不必再彈
  if (pathname === row.link_path) return false
  if (pathMatches(pathname, row.exclude_paths || [])) return false
  const include = row.include_paths || []
  if (include.length > 0 && !pathMatches(pathname, include)) return false
  return true
}

/**
 * 挑出要顯示的那一個。
 *
 * 同時只顯示一個 —— 兩個彈窗疊在一起是最快讓人關掉整個網站的方法。
 * 依 priority 由大到小，同分取 id 較大的（較新的）。
 */
export function pickPopup(
  rows: readonly PopupRow[], pathname: string, now: Date = new Date(),
): PopupRow | null {
  const usable = rows
    .filter(r => r.is_active)
    .filter(r => isWithinWindow(r, now))
    .filter(r => isPathAllowed(r, pathname))

  if (usable.length === 0) return null
  return usable.slice().sort((a, b) =>
    b.priority - a.priority || b.id - a.id)[0]
}

/** 每個彈窗各自的冷卻紀錄，換一個彈窗不會被上一個的冷卻擋住 */
export function storageKeyFor(popupId: number): string {
  return `site_popup_seen_${popupId}`
}

export function isInCooldown(
  lastShownAt: number | null, cooldownHours: number, now: Date = new Date(),
): boolean {
  if (lastShownAt === null) return false
  if (cooldownHours <= 0) return false
  return now.getTime() - lastShownAt < cooldownHours * 3600_000
}

export const POPUP_PERMISSION = 'site_popup.manage'
