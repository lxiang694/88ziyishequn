import { validateRow, type ImportRow, type Marketplace, type PickupStore } from './domain'

/**
 * 團購訂單轉賣貨便（純函式，可測試）。
 *
 * 與一般訂單的差別：
 *   • 不用「商品賣場配對」—— 一張團購訂單整張依溫層對應賣場：
 *     7-11 冷凍 → 冷凍賣場；7-11 常溫 → 常溫賣場
 *   • 代收金額 = 應收總額（商品＋團購運費），運費欄填 0（與一般訂單同一套做法）
 *   • 不拆單
 * 資料庫的 myship_reserve_group_buy_batch 會再逐欄比對一次（見 myship_group_buy.sql）。
 */
export type GroupBuyMethod = '711' | '711_normal' | 'home'
export interface GroupBuyTransferItem { id: number; name_snapshot: string; spec_snapshot: string; unit_price: number; quantity: number; subtotal: number }
export interface GroupBuyTransferOrder {
  id: number; order_no: string; campaign_id: number; customer_name: string; phone: string
  shipping_method: GroupBuyMethod; store_id: number | null; store_name: string | null; store_address: string | null
  note: string; subtotal: number; shipping_fee: number; total_amount: number; status: string; created_at: string
  group_buy_order_items: GroupBuyTransferItem[]
}

export const GROUP_BUY_MARKER_PREFIX = '健康優選團購：'
export const groupBuyMarker = (orderNo: string) => GROUP_BUY_MARKER_PREFIX + orderNo

/** 取貨方式對應的溫層；宅配不走賣貨便 */
export function temperatureOf(method: GroupBuyMethod): '冷凍' | '常溫' | null {
  return method === '711' ? '冷凍' : method === '711_normal' ? '常溫' : null
}

const normalized = (s: string) => s.replace(/台/g, '臺').replace(/\s/g, '')

/** 與賣場無關的檢查：狀態、門市、金額。清單上顯示，也決定能不能勾選 */
export function groupBuyOrderErrors(order: GroupBuyTransferOrder, store?: PickupStore): string[] {
  const errors: string[] = []
  if (order.status !== '待出貨') errors.push('團購訂單已不是待出貨')
  if (!temperatureOf(order.shipping_method)) errors.push('黑貓宅配不走賣貨便')
  const items = order.group_buy_order_items || []
  if (!items.length) errors.push('訂單沒有商品明細')
  if (!store || store.id !== order.store_id || !store.is_active) errors.push('門市不存在或已停用')
  else if (normalized(store.store_name) !== normalized(order.store_name || '') || normalized(store.address) !== normalized(order.store_address || '')) {
    errors.push('門市目前名稱或地址與訂單不一致，請核對')
  }
  if (items.reduce((n, i) => n + i.subtotal, 0) !== order.subtotal || order.subtotal + order.shipping_fee !== order.total_amount) {
    errors.push('訂單金額與商品小計不一致')
  }
  return errors
}

/** 商品明細欄：品名（規格）×數量；有團購運費時寫在最後，代收金額才對得起來 */
function goodsText(order: GroupBuyTransferOrder): string {
  const items = [...order.group_buy_order_items].sort((a, b) => a.id - b.id)
  const text = items.map(i => `${i.name_snapshot}${i.spec_snapshot ? `（${i.spec_snapshot}）` : ''}×${i.quantity}`).join('；')
  return order.shipping_fee > 0 ? `${text}；運費${order.shipping_fee}元` : text
}

/** 產生這張團購訂單在指定賣場的匯入列；有任何問題就不給列 */
export function prepareGroupBuyRow(order: GroupBuyTransferOrder, market: Marketplace | undefined, store?: PickupStore):
  { row: ImportRow | null; errors: string[] } {
  const errors = groupBuyOrderErrors(order, store)
  const temp = temperatureOf(order.shipping_method)
  if (!market) errors.push('請選擇賣場')
  else {
    if (!market.enabled) errors.push('賣場尚未啟用')
    if (temp && market.temperature !== temp) errors.push(`這是 7-11 ${temp}訂單，請選${temp}賣場`)
  }
  const date = new Date(order.created_at)
  const dateText = Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '/') : ''
  const row: ImportRow = [order.customer_name.trim(), order.phone.trim(), store?.store_code || '', temp || '常溫',
    goodsText(order), String(order.total_amount), '0', dateText, order.note || '', groupBuyMarker(order.order_no)]
  errors.push(...validateRow(row))
  const unique = [...new Set(errors)]
  return { row: unique.length ? null : row, errors: unique }
}
