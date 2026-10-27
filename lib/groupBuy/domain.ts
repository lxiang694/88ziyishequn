import { recipientNameError } from '../recipientName'

/**
 * 團購（每月一檔）：純函式，前台、後台、API 共用，可單元測試。
 *
 * 真正的把關在資料庫的 place_group_buy_order（migrations/group_buy_schema.sql）：
 * 時間、運送方式、限量、限購、金額都在那裡再算一次。這裡的檢查是為了在送出前
 * 就給客人看得懂的提示，不是唯一防線。
 */

/** 711 = 7-11 冷凍（最早就有，代碼不改，舊訂單不受影響）；711_normal = 7-11 常溫 */
export type ShippingMethod = '711' | '711_normal' | 'home'
export const SHIPPING_METHODS: ShippingMethod[] = ['711', '711_normal', 'home']
export const SHIPPING_LABEL: Record<ShippingMethod, string> = {
  '711': '7-11 冷凍取貨付款',
  '711_normal': '7-11 常溫取貨付款',
  home: '黑貓冷凍宅配（貨到付款）',
}
export const SHIPPING_SHORT: Record<ShippingMethod, string> = { '711': '7-11 冷凍', '711_normal': '7-11 常溫', home: '黑貓宅配' }
/** 兩種 7-11 都要選門市、取貨時付款 */
export const isStorePickup = (m: ShippingMethod) => m === '711' || m === '711_normal'
export const DELIVERY_TIMES = ['不指定', '13點前', '14-18點'] as const
export const ORDER_STATUSES = ['待出貨', '已出貨', '已完成', '已取消'] as const
export type GroupBuyOrderStatus = typeof ORDER_STATUSES[number]

export interface Campaign {
  id: number
  slug: string
  title: string
  subtitle: string
  description: string
  cover_image_url: string | null
  starts_at: string
  ends_at: string
  ship_note: string
  ship_711_enabled: boolean
  ship_711_normal_enabled: boolean
  ship_home_enabled: boolean
  fee_711: number
  fee_711_normal: number
  fee_home: number
  free_shipping_threshold: number | null
  is_published: boolean
}

export interface Item {
  id: number
  campaign_id: number
  name: string
  spec: string
  description: string
  image_url: string | null
  price: number
  original_price: number | null
  per_person_limit: number | null
  total_quota: number | null
  sort_order: number
  is_active: boolean
}

export type Phase = 'draft' | 'upcoming' | 'open' | 'closed'

/** 檔期現在在哪個階段。截單時間那一刻起就算已截單（與資料庫的 now() >= ends_at 一致） */
export function campaignPhase(c: Pick<Campaign, 'is_published' | 'starts_at' | 'ends_at'>, now = new Date()): Phase {
  if (!c.is_published) return 'draft'
  const t = now.getTime()
  if (t < new Date(c.starts_at).getTime()) return 'upcoming'
  if (t >= new Date(c.ends_at).getTime()) return 'closed'
  return 'open'
}

export const PHASE_LABEL: Record<Phase, string> = {
  draft: '已關閉', upcoming: '預告中', open: '開團中', closed: '已截單',
}

/** 運費：與資料庫同一套規則（滿額免運套用在兩種運送方式） */
type FeeFields = Pick<Campaign, 'fee_711' | 'fee_home' | 'free_shipping_threshold'> & { fee_711_normal?: number | null }

/** 這種取貨方式的基本運費（未套免運） */
export function methodFee(c: FeeFields, method: ShippingMethod) {
  return method === '711' ? c.fee_711 : method === '711_normal' ? (c.fee_711_normal ?? 0) : c.fee_home
}

export function shippingFee(c: FeeFields, method: ShippingMethod, subtotal: number) {
  if (c.free_shipping_threshold != null && subtotal >= c.free_shipping_threshold) return 0
  return methodFee(c, method)
}

export function enabledMethods(c: Pick<Campaign, 'ship_711_enabled' | 'ship_home_enabled'> & { ship_711_normal_enabled?: boolean | null }): ShippingMethod[] {
  return SHIPPING_METHODS.filter(m =>
    m === '711' ? c.ship_711_enabled : m === '711_normal' ? !!c.ship_711_normal_enabled : c.ship_home_enabled)
}

/** 團購單號：GB + 台灣日期 8 碼 + 6 碼亂數（資料庫限制 ^GB[0-9]{14}$） */
export function generateGroupBuyOrderNo(now = new Date(), rand = Math.random()) {
  const tw = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '')
  return `GB${tw}${String(Math.floor(rand * 1_000_000)).padStart(6, '0')}`
}

// ── 台灣時間 ─────────────────────────────────────────────
// 後台的日期時間欄位（datetime-local）沒有時區，一律視為台灣時間。

/** '2026-11-01T10:00' → ISO（UTC）。格式不對回傳 null */
export function twLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || '')) return null
  const d = new Date(`${local}:00+08:00`)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

/** ISO → '2026-11-01T10:00'（台灣時間），給 datetime-local 欄位用 */
export function isoToTwLocal(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 16)
}

/** 給客人看的日期：11/10（一）23:59 */
export function formatTwDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000)
  const w = '日一二三四五六'[d.getUTCDay()]
  const hm = d.toISOString().slice(11, 16)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）${hm}`
}

// ── 每月複製上一檔 ───────────────────────────────────────

/** 同一個時間點往後推 n 個月（台灣時間的日、時、分不變；月底日期遇到短月份就落在月底） */
export function addMonths(iso: string, n = 1): string {
  const tw = new Date(new Date(iso).getTime() + 8 * 3600_000)
  const y = tw.getUTCFullYear(), m = tw.getUTCMonth() + n
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const day = Math.min(tw.getUTCDate(), lastDay)
  const shifted = Date.UTC(y, m, day, tw.getUTCHours(), tw.getUTCMinutes())
  return new Date(shifted - 8 * 3600_000).toISOString()
}

/** 檔期網址代稱：開團月份，例如 2026-11；重複時加 -2、-3 */
export function slugForStart(iso: string, taken: readonly string[] = []) {
  const base = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 7)
  if (!taken.includes(base)) return base
  for (let i = 2; i < 100; i++) if (!taken.includes(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

// ── 下單資料檢查 ─────────────────────────────────────────

export interface CheckoutInput {
  customer_name: string
  phone: string
  shipping_method: ShippingMethod
  store_id?: number | null
  home_address?: string
  delivery_time?: string
  note?: string
  items: { item_id: number; quantity: number }[]
}

/** 回傳第一個問題（給人看的中文）；沒問題回傳 null */
export function checkoutProblem(input: Partial<CheckoutInput>, methods: ShippingMethod[]): string | null {
  const name = (input.customer_name || '').trim()
  if (!name) return '請填寫收件人姓名'
  if (Array.from(name).length > 20) return '姓名太長'
  if (!/^09\d{8}$/.test((input.phone || '').trim())) return '請填寫正確的手機號碼（09 開頭 10 碼）'
  if (!input.shipping_method || !methods.includes(input.shipping_method)) return '請選擇取貨方式'
  if (isStorePickup(input.shipping_method) && !(Number.isSafeInteger(input.store_id) && (input.store_id as number) > 0)) return '請選擇 7-11 取貨門市'
  // 7-11 取貨：姓名要符合賣貨便規則（只能中英文、2～5 個中文字），不然轉單會被擋
  if (isStorePickup(input.shipping_method)) {
    const nameProblem = recipientNameError(name)
    if (nameProblem) return nameProblem
  }
  if (input.shipping_method === 'home') {
    const addr = (input.home_address || '').trim()
    if (Array.from(addr).length < 8) return '請填寫完整的收件地址（含縣市、區、路、門牌）'
    if (Array.from(addr).length > 200) return '地址太長'
    if (input.delivery_time && !(DELIVERY_TIMES as readonly string[]).includes(input.delivery_time)) return '配送時段不正確'
  }
  if ((input.note || '').length > 200) return '備註最多 200 字'
  const items = input.items || []
  if (!items.length) return '請至少選一樣商品'
  if (items.length > 20) return '一次最多 20 樣商品'
  const ids = new Set<number>()
  for (const it of items) {
    if (!Number.isSafeInteger(it.item_id) || it.item_id < 1) return '商品資料不正確'
    if (!Number.isSafeInteger(it.quantity) || it.quantity < 1 || it.quantity > 999) return '數量不正確'
    if (ids.has(it.item_id)) return '商品重複'
    ids.add(it.item_id)
  }
  return null
}

/**
 * 資料庫擋下的原因（RAISE EXCEPTION 的訊息）本身就是寫給客人看的中文，
 * 認得的直接顯示；其他（連線、約束錯誤）一律換成通用訊息，不把技術細節丟給客人。
 */
const KNOWN_DB_ERRORS = [/團購不存在/, /還沒開始/, /已截單/, /沒有開放/, /門市/, /收件地址/, /取貨方式/,
  /至少選一樣/, /商品重複/, /數量不正確/, /已下架/, /剩 \d+ 件/, /每人限購/]
export function friendlyOrderError(message: string | undefined): string {
  const m = (message || '').trim()
  return KNOWN_DB_ERRORS.some(re => re.test(m)) ? m : '下單失敗，請稍後再試或聯絡客服'
}

// ── 叫貨匯總 ─────────────────────────────────────────────

export interface SummaryOrder {
  status: string
  shipping_method: ShippingMethod
  total_amount: number
  items: { item_id: number; name_snapshot: string; spec_snapshot: string; quantity: number; subtotal: number }[]
}

/** 截單後給品牌方的叫貨數量：每個商品總共幾件（不含已取消），並依取貨方式分開 */
export function supplierSummary(orders: readonly SummaryOrder[]) {
  const rows = new Map<number, { item_id: number; name: string; spec: string; quantity: number; byMethod: Record<ShippingMethod, number>; amount: number }>()
  let orderCount = 0, revenue = 0
  for (const o of orders) {
    if (o.status === '已取消') continue
    orderCount++
    revenue += o.total_amount
    for (const it of o.items) {
      const r = rows.get(it.item_id) || { item_id: it.item_id, name: it.name_snapshot, spec: it.spec_snapshot, quantity: 0, byMethod: { '711': 0, '711_normal': 0, home: 0 }, amount: 0 }
      r.quantity += it.quantity
      r.byMethod[o.shipping_method] = (r.byMethod[o.shipping_method] || 0) + it.quantity
      r.amount += it.subtotal
      rows.set(it.item_id, r)
    }
  }
  return { orderCount, revenue, items: [...rows.values()].sort((a, b) => b.quantity - a.quantity) }
}

/** CSV 一格：含逗號、引號、換行時加引號；開頭是 = + - @ 時前面補一個單引號，避免 Excel 當成公式執行 */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * 手機、門市店號這類「看起來是數字的文字」：用 ="0912345678" 的寫法，
 * Excel 打開才不會把開頭的 0 吃掉。只接受純數字，不會被拿來塞公式。
 */
export function csvDigits(v: string | null | undefined): string {
  const s = (v || '').trim()
  return /^\d{1,20}$/.test(s) ? `"=""${s}"""` : csvCell(s)
}
