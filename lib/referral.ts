/**
 * 好友推薦（純函式，前後台共用，可測試）。
 *
 * 每位會員一組 6 碼推薦碼（不用 0/O/1/I 這些容易看錯的字），分享連結帶 ?ref=推薦碼。
 * 朋友點進來後記在瀏覽器 30 天；這段期間註冊或下單，就算是這位會員推薦的。
 */
export const REF_PARAM = 'ref'
export const REF_STORAGE_KEY = 'referral_ref'
export const REF_TTL_DAYS = 30
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeCode(v: unknown): string | null {
  const code = typeof v === 'string' ? v.trim().toUpperCase() : ''
  return /^[A-Z2-9]{6}$/.test(code) && [...code].every(c => ALPHABET.includes(c)) ? code : null
}

/** 產生推薦碼；random 可注入方便測試 */
export function generateCode(random: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length]
  return s
}

/**
 * 在網址加上推薦碼。連結刻意保持短（只有 ?ref=），長輩看到一長串參數會以為是廣告；
 * 流量來源由前台埋點看到 ref 時自動標成「親友推薦」。medium 保留給呼叫端標示分享位置。
 */
export function withReferral(url: string, code: string | null | undefined, _medium = 'share'): string {
  if (!code) return url
  try {
    const u = new URL(url)
    u.searchParams.set(REF_PARAM, code)
    return u.toString()
  } catch {
    return url
  }
}

/** 瀏覽器裡記的推薦碼（含過期判斷） */
export function readStoredRef(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (!v?.code || now - Number(v.at) > REF_TTL_DAYS * 86_400_000) return null
    return normalizeCode(v.code)
  } catch {
    return null
  }
}

export interface ShareTemplate { key: string; title: string; text: (link: string, name?: string) => string }

/**
 * 邀請文案範本。刻意寫成「分享」而不是「推銷」：
 * 不提療效（食品廣告不得宣稱療效），講的是取貨方便、可以先看看、有問題能問。
 */
export const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    key: 'general',
    title: '推薦給親友',
    text: link => `跟你分享我常買保健品的地方 😊\n商品介紹寫得很清楚，7-11 取貨付款，不用先付錢，免註冊也能買。\n有需要可以看看👇\n${link}`,
  },
  {
    key: 'family',
    title: '給家人',
    text: link => `這是我平常買保健食品的網站，東西我自己用過覺得不錯。\n你可以先看看成分和其他人的評價，有問題也能直接 LINE 問客服 🙏\n${link}`,
  },
  {
    key: 'quiz',
    title: '邀請做健康檢測',
    text: link => `這個網站有免費的睡眠、健康小檢測，幾分鐘就做完，可以看看自己狀況 😊\n${link}`,
  },
]

export interface ReferredOrder { phone: string; order_no: string; created_at: string; total: number; referral_code: string }

/**
 * 推薦帶來的「新客」：這支手機的第一張訂單（一般＋團購）就是推薦訂單。
 * firstOrderByPhone：每支手機最早一張訂單的 order_no。
 */
export function referralOutcome(orders: ReferredOrder[], firstOrderByPhone: Map<string, string>) {
  const byCode = new Map<string, { orders: number; revenue: number; buyers: Set<string>; newCustomers: Set<string> }>()
  for (const o of orders) {
    const s = byCode.get(o.referral_code) || { orders: 0, revenue: 0, buyers: new Set<string>(), newCustomers: new Set<string>() }
    s.orders++
    s.revenue += Number(o.total) || 0
    s.buyers.add(o.phone)
    if (firstOrderByPhone.get(o.phone) === o.order_no) s.newCustomers.add(o.phone)
    byCode.set(o.referral_code, s)
  }
  return new Map([...byCode].map(([code, s]) => [code, { orders: s.orders, revenue: Math.round(s.revenue), buyers: s.buyers.size, new_customers: s.newCustomers.size }]))
}
