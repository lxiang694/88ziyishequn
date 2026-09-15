/**
 * 快速下單的共用常數與驗證 —— 純函式。
 *
 * 來源清單與 migrations/orders_source.sql 的 orders_source_chk
 * 必須一致。兩邊不同步的話，資料庫會擋下來，但錯誤訊息很難看懂，
 * 所以在這一層先擋。
 */

export const ORDER_SOURCES = [
  { key: 'line_dm', label: 'Line 私訊' },
  { key: 'line_group', label: 'Line 社群' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'threads', label: 'Threads' },
  { key: 'fb_ad', label: 'Facebook 廣告' },
  { key: 'phone', label: '電話' },
  { key: 'web', label: '客戶自行於網站下單' },
  { key: 'other', label: '其他' },
] as const

export type OrderSource = typeof ORDER_SOURCES[number]['key']

const SOURCE_KEYS = new Set(ORDER_SOURCES.map(s => s.key as string))

export function isValidSource(v: unknown): v is OrderSource {
  return typeof v === 'string' && SOURCE_KEYS.has(v)
}

/** 代客下單的預設來源：這個功能就是為了 Line 私訊做的 */
export const DEFAULT_QUICK_ORDER_SOURCE: OrderSource = 'line_dm'

/** 建立訂單的權限。與「查看」「編輯」分開 —— 代客下單會產生真實金流 */
export const QUICK_ORDER_PERMISSION = 'orders.create'

export const MAX_ITEMS_PER_ORDER = 20
export const MAX_QTY_PER_ITEM = 999

export interface ResolvedItem {
  product_id: number
  variant_id: number
  quantity: number
}

export class QuickOrderInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuickOrderInputError'
  }
}

/**
 * 驗證畫面送回來的品項。
 *
 * 刻意**不接受**前端傳來的單價 —— 價格一律由伺服器從
 * product_variants 重新查。前端能改的東西不能決定收多少錢。
 */
export function parseResolvedItems(raw: unknown): ResolvedItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new QuickOrderInputError('請至少加入一項商品')
  }
  if (raw.length > MAX_ITEMS_PER_ORDER) {
    throw new QuickOrderInputError(`一張訂單最多 ${MAX_ITEMS_PER_ORDER} 項`)
  }

  const seen = new Set<number>()
  return raw.map((r: any, i: number) => {
    const product_id = Number(r?.product_id)
    const variant_id = Number(r?.variant_id)
    const quantity = Number(r?.quantity)

    if (!Number.isInteger(product_id) || product_id <= 0
      || !Number.isInteger(variant_id) || variant_id <= 0) {
      throw new QuickOrderInputError(`第 ${i + 1} 項商品尚未選定規格`)
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
      throw new QuickOrderInputError(`第 ${i + 1} 項的數量不正確`)
    }
    // 同一個規格出現兩次，庫存會被扣兩次而畫面只顯示一行，
    // 結帳頁不會發生（購物車會合併），但手動加商品會。
    if (seen.has(variant_id)) {
      throw new QuickOrderInputError('同一個規格重複出現，請合併成一項')
    }
    seen.add(variant_id)

    return { product_id, variant_id, quantity }
  })
}
