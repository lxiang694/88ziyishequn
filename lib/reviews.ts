/**
 * 商品評價（純函式，前後台共用，可測試）。
 *
 * 照台灣購物網站的習慣：1～5 顆星、快速標籤、名字遮蔽（王*明）、
 * 「已購買」標示、賣家回覆、可以依星數篩選。
 */

export const RATING_LABELS: Record<number, string> = {
  1: '很不滿意', 2: '不太滿意', 3: '普通', 4: '滿意', 5: '非常滿意',
}

/** 寫評價時可以點選的快速標籤（不放療效類字眼，避免變成誇大宣稱） */
export const REVIEW_TAGS = [
  '品質很好', '很好入口', 'CP值高', '包裝完整', '出貨快速', '會再回購', '家人也愛用', '客服親切',
] as const

export const REVIEW_MIN_LENGTH = 5
export const REVIEW_MAX_LENGTH = 500
export const REVIEW_PAGE_SIZE = 10

export interface PublicReview {
  id: number
  display_name: string
  rating: number
  content: string
  tags: string[]
  variant_name: string | null
  verified_purchase: boolean
  admin_reply: string | null
  admin_reply_at: string | null
  created_at: string
}

export interface ReviewSummary {
  count: number
  /** 平均分數，一位小數；沒有評價時是 0 */
  average: number
  /** 各星數的則數，key 是 1～5 */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  verified: number
}

export const EMPTY_SUMMARY: ReviewSummary = { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, verified: 0 }

export function summarizeReviews(rows: { rating: number; verified_purchase?: boolean }[]): ReviewSummary {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let verified = 0
  for (const r of rows) {
    const star = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5
    if (star < 1 || star > 5) continue
    distribution[star]++
    total += star
    if (r.verified_purchase) verified++
  }
  const count = distribution[1] + distribution[2] + distribution[3] + distribution[4] + distribution[5]
  return { count, average: count ? Math.round((total / count) * 10) / 10 : 0, distribution, verified }
}

/**
 * 公開顯示用的遮蔽名字：
 *   王小明 → 王*明　王明 → 王*　Jessica → J*****a　abc123@gmail.com → a****3
 */
export function maskName(name?: string | null, email?: string | null): string {
  const base = (name || '').trim() || (email || '').split('@')[0].trim()
  const chars = Array.from(base.replace(/\s+/g, ''))
  if (!chars.length) return '會員'
  if (chars.length === 1) return `${chars[0]}*`
  if (chars.length === 2) return `${chars[0]}*`
  const middle = Math.min(chars.length - 2, 6)
  return `${chars[0]}${'*'.repeat(middle)}${chars[chars.length - 1]}`
}

export interface ReviewInput { rating: number; content: string; tags: string[] }

/** 檢查會員送來的評價；回傳整理好的內容或第一個錯誤 */
export function validateReview(body: any): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const rating = Number(body?.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: '請選擇 1～5 顆星' }
  const content = typeof body?.content === 'string' ? body.content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : ''
  const length = Array.from(content).length
  if (length < REVIEW_MIN_LENGTH) return { ok: false, error: `評價內容至少 ${REVIEW_MIN_LENGTH} 個字` }
  if (length > REVIEW_MAX_LENGTH) return { ok: false, error: `評價內容最多 ${REVIEW_MAX_LENGTH} 個字` }
  const tags: string[] = Array.isArray(body?.tags)
    ? [...new Set<string>(body.tags.filter((t: unknown): t is string => typeof t === 'string' && (REVIEW_TAGS as readonly string[]).includes(t)))]
    : []
  return { ok: true, value: { rating, content, tags: tags.slice(0, 6) } }
}

/** 評價日期：台灣時間 YYYY/MM/DD */
export function reviewDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000)
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10).replace(/-/g, '/') : ''
}
