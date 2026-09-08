/**
 * 彈窗設定的輸入驗證 —— 純函式，可單元測試。
 *
 * 這些內容會直接顯示給所有訪客，所以限長與格式在這裡就擋掉，
 * 不要等到資料庫 constraint 才報一個看不懂的錯誤。
 */

export class PopupInputError extends Error {
  field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.name = 'PopupInputError'
    this.field = field
  }
}

const MAX = {
  NAME: 40, TITLE: 40, BODY: 120, CTA: 20, BADGE: 30, PRICE: 30, PATH: 200,
}
export const POPUP_LIMITS = MAX

function text(v: unknown, field: string, max: number, required = true): string {
  if (typeof v !== 'string') {
    if (!required && (v === undefined || v === null)) return ''
    throw new PopupInputError(`${field} 必須是文字`, field)
  }
  const s = v.trim()
  if (required && !s) throw new PopupInputError(`${field} 為必填`, field)
  if (s.length > max) throw new PopupInputError(`${field} 超過 ${max} 字上限`, field)
  return s
}

function int(v: unknown, field: string, min: number, max: number, fallback?: number): number {
  if (v === undefined || v === null || v === '') {
    if (fallback !== undefined) return fallback
    throw new PopupInputError(`${field} 為必填`, field)
  }
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new PopupInputError(`${field} 須為 ${min} 到 ${max} 之間的整數`, field)
  }
  return n
}

function isoDate(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null
  const s = String(v).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new PopupInputError(`${field} 格式須為 YYYY-MM-DD`, field)
  }
  return s
}

/**
 * 站內路徑檢查。
 *
 * 必須以單一 / 開頭（`//evil.example` 在瀏覽器會被當成外部網址），
 * 而且不可帶參數 —— query string 會進到伺服器 log 與 analytics。
 */
export function parsePath(v: unknown, field: string): string {
  const s = text(v, field, MAX.PATH)
  if (!s.startsWith('/') || s.startsWith('//')) {
    throw new PopupInputError(`${field} 只能是站內路徑，需以 / 開頭`, field)
  }
  if (s.includes('?') || s.includes('#')) {
    throw new PopupInputError(`${field} 不可帶參數`, field)
  }
  return s
}

function pathList(v: unknown, field: string): string[] {
  if (v === undefined || v === null || v === '') return []
  const arr = Array.isArray(v)
    ? v
    : String(v).split(/[\n,]/)
  return arr
    .map(x => String(x).trim())
    .filter(Boolean)
    .map(x => parsePath(x, field))
    .slice(0, 20)
}

function imageUrl(v: unknown): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null
  const s = String(v).trim()
  if (!/^https?:\/\//.test(s)) {
    throw new PopupInputError('圖片網址需以 http:// 或 https:// 開頭', 'image_url')
  }
  if (s.length > 500) throw new PopupInputError('圖片網址過長', 'image_url')
  return s
}

export interface PopupInput {
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

export function parsePopupInput(raw: unknown): PopupInput {
  if (!raw || typeof raw !== 'object') throw new PopupInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>

  const starts = isoDate(b.starts_at, '開始日期')
  const ends = isoDate(b.ends_at, '結束日期')
  if (starts && ends && starts > ends) {
    throw new PopupInputError('結束日期不可早於開始日期', 'ends_at')
  }

  return {
    name: text(b.name, '彈窗名稱', MAX.NAME),
    badge_text: text(b.badge_text, '小標籤', MAX.BADGE, false) || null,
    title: text(b.title, '標題', MAX.TITLE),
    body: text(b.body, '內文', MAX.BODY, false) || null,
    price_text: text(b.price_text, '價格文字', MAX.PRICE, false) || null,
    image_url: imageUrl(b.image_url),
    cta_text: text(b.cta_text, '按鈕文字', MAX.CTA),
    link_path: parsePath(b.link_path, '連結路徑'),
    product_slug: text(b.product_slug, '商品識別碼', 60, false) || null,
    // 新增時一律先關著：內容還沒檢查過就直接對全站訪客顯示風險太大
    is_active: b.is_active === true,
    priority: int(b.priority, '優先順序', 0, 1000, 0),
    delay_ms: int(b.delay_ms, '延遲顯示（毫秒）', 0, 60000, 800),
    auto_close_ms: int(b.auto_close_ms, '自動關閉（毫秒）', 0, 120000, 5000),
    cooldown_hours: int(b.cooldown_hours, '冷卻時間（小時）', 0, 720, 12),
    starts_at: starts,
    ends_at: ends,
    include_paths: pathList(b.include_paths, '只在這些路徑顯示'),
    exclude_paths: pathList(b.exclude_paths, '排除路徑'),
  }
}
