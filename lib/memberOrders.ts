/**
 * 會員中心的訂單整理（純函式，前後台共用，可測試）。
 *
 * 一般訂單與團購訂單整理成同一種格式，並換算成客人看得懂的進度：
 *   一般訂單：已下單 → 處理中 → 已出貨 → 已到店（可取貨）
 *   團購訂單：已跟團 → 已出貨 → 已完成
 */
export type MemberOrderKind = 'shop' | 'group_buy'

export interface MemberOrderItem {
  name: string
  variant: string
  quantity: number
  subtotal: number
  image: string | null
  product_id: number | null
  variant_id: number | null
}

export interface MemberOrder {
  kind: MemberOrderKind
  id: number
  order_no: string
  status: string
  created_at: string
  /** 狀態最後更新時間（到店日）；沒有時用下單時間 */
  updated_at?: string | null
  total: number
  store_name: string | null
  store_area: string
  phone: string
  items: MemberOrderItem[]
  campaign_title?: string
}

export interface Stage { steps: string[]; current: number; done: boolean; cancelled: boolean; hint: string }

const SHOP_STEPS = ['已下單', '處理中', '已出貨', '已到店']
const GROUP_STEPS = ['已跟團', '已出貨', '已完成']

/** 訂單進度：第幾步、給客人看的一句話 */
/** 7-11 包裹保留 7 天；到店超過 8 天就不再提醒取貨，當成已完成 */
const PICKUP_DAYS = 8
const DAY_MS = 86_400_000
function arrivedLongAgo(o: Pick<MemberOrder, 'created_at' | 'updated_at'>, now: number) {
  return now - new Date(o.updated_at || o.created_at).getTime() > PICKUP_DAYS * DAY_MS
}

export function orderStage(o: Pick<MemberOrder, 'kind' | 'status' | 'store_name' | 'created_at' | 'updated_at'>, now = Date.now()): Stage {
  const store = o.store_name ? `7-11 ${o.store_name}門市` : '7-11 門市'
  if (o.status === '已取消') return { steps: o.kind === 'shop' ? SHOP_STEPS : GROUP_STEPS, current: -1, done: false, cancelled: true, hint: '這筆訂單已取消' }
  if (o.kind === 'group_buy') {
    const current = o.status === '已完成' ? 2 : o.status === '已出貨' ? 1 : 0
    const hint = current === 0 ? '截單後統一出貨，到店時 7-11 會傳簡訊通知' : current === 1 ? `已出貨，到 ${store} 時會收到 7-11 簡訊` : '已完成，謝謝您跟團'
    return { steps: GROUP_STEPS, current, done: current === 2, cancelled: false, hint }
  }
  const map: Record<string, number> = { 待確認: 0, 已確認: 1, 備貨中: 1, 已出貨: 2, 已到店: 3 }
  const current = map[o.status] ?? 0
  const hint = [
    '我們會在 1 個工作日內確認並安排出貨',
    '正在備貨，準備寄出',
    `已寄出，送達 ${store} 時 7-11 會傳簡訊通知`,
    arrivedLongAgo(o, now) ? '已送達門市，謝謝您的訂購' : `已到 ${store}，請報取件人姓名或手機號碼取貨付款`,
  ][current]
  return { steps: SHOP_STEPS, current, done: current === 3, cancelled: false, hint }
}

/** 還在進行中（沒取消、還沒走完最後一步） */
export function isActiveOrder(o: MemberOrder): boolean {
  const s = orderStage(o)
  return !s.cancelled && !s.done
}

/** 等客人去取貨：一般訂單已到店 */
export function isReadyForPickup(o: MemberOrder, now = Date.now()): boolean {
  return o.kind === 'shop' && o.status === '已到店' && !arrivedLongAgo(o, now)
}

/** 常買的規格（依購買次數），做「再買一次」用；只算一般訂單、未取消 */
export function frequentVariants(orders: MemberOrder[], limit = 6): { product_id: number; variant_id: number; times: number; last_at: string }[] {
  const m = new Map<number, { product_id: number; variant_id: number; times: number; last_at: string }>()
  for (const o of orders) {
    if (o.kind !== 'shop' || o.status === '已取消') continue
    for (const it of o.items) {
      if (!it.product_id || !it.variant_id) continue
      const cur = m.get(it.variant_id)
      if (cur) { cur.times++; if (o.created_at > cur.last_at) cur.last_at = o.created_at }
      else m.set(it.variant_id, { product_id: it.product_id, variant_id: it.variant_id, times: 1, last_at: o.created_at })
    }
  }
  return [...m.values()].sort((a, b) => b.times - a.times || b.last_at.localeCompare(a.last_at)).slice(0, limit)
}

/** 可以寫評價的商品：已出貨或已到店的一般訂單裡、還沒評價過的 */
export function reviewableProductIds(orders: MemberOrder[], reviewed: Set<number>): number[] {
  const ids: number[] = []
  for (const o of [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (o.kind !== 'shop' || !['已出貨', '已到店'].includes(o.status)) continue
    for (const it of o.items) if (it.product_id && !reviewed.has(it.product_id) && !ids.includes(it.product_id)) ids.push(it.product_id)
  }
  return ids
}
