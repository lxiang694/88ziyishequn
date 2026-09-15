export const MAX_ROWS = 500
export type ImportRow = [string, string, string, string, string, string, string, string, string, string]
export interface TransferItem {
  id: number; variant_id: number | null; product_name_snapshot: string
  variant_name_snapshot: string; sku_snapshot: string | null
  unit_price: number; quantity: number; subtotal: number
}
export interface TransferOrder {
  id: number; order_no: string; customer_name: string; phone: string
  store_id: number | null; store_name: string; store_address: string
  order_status: string; total_amount: number; created_at: string; updated_at: string
  note: string | null; order_items: TransferItem[]
}
export interface Marketplace { id: string; name: string; temperature: string; enabled: boolean }
export interface Mapping { variant_id: number; marketplace_id: string }
export interface PickupStore { id: number; store_code: string | null; store_name: string; address: string; is_active: boolean }
export interface PreparedOrder {
  order_id: number; order_no: string; marketplace_id: string | null
  errors: string[]; row: ImportRow | null
}

const textLength = (s: string) => Array.from(s).length
const nameLength = (s: string) => Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0)
const normalized = (s: string) => s.replace(/台/g, '臺').replace(/\s/g, '')
const illegalXml = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/

export function validateRow(row: readonly string[]): string[] {
  if (row.length !== 10 || row.some(v => typeof v !== 'string')) return ['匯入欄位格式不符']
  const [name, phone, store, temperature, goods, amount, freight, date, memo, other] = row
  const errors: string[] = []
  // 範本 A4：10個半形字元或5個中文字，不允許數字及特殊符號。
  if (!name || nameLength(name) > 10 || !/^[\p{L}\p{M} ]+$/u.test(name)) errors.push('姓名需為中文或英文字母，最多5個中文字或10個半形字元')
  if (!/^09\d{8}$/.test(phone)) errors.push('手機需為09開頭的10碼數字')
  if (!/^\d{6}$/.test(store)) errors.push('缺少有效的6碼門市店號')
  if (!['常溫', '冷凍'].includes(temperature)) errors.push('溫層需為常溫或冷凍')
  if (!goods || textLength(goods) > 200) errors.push('商品明細不可空白或超過200字')
  const integer = (s: string) => /^(0|[1-9]\d*)$/.test(s)
  if (!integer(amount) || Number(amount) > 20000) errors.push('訂單金額需為0至20000的整數')
  if (!integer(freight) || Number(freight) > 100) errors.push('運費需為0至100的整數')
  if (Number(amount) + Number(freight) < 55 || Number(amount) + Number(freight) > 20000) errors.push('代收總額需介於55至20000元')
  if (date && !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(date)) errors.push('下訂日期格式錯誤')
  if (textLength(memo) > 200 || textLength(other) > 200) errors.push('備註或其他資訊超過200字，不可直接截斷')
  if (row.some(v => illegalXml.test(v) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))) errors.push('資料包含無法匯出的字元')
  return errors
}

export function prepareOrder(order: TransferOrder, mappings: Mapping[], markets: Marketplace[], store?: PickupStore): PreparedOrder {
  const errors: string[] = []
  if (order.order_status !== '待確認') errors.push('訂單已不是待確認')
  const items = [...(order.order_items || [])].sort((a, b) => a.id - b.id)
  if (!items.length) errors.push('訂單沒有商品明細')
  const ids = items.map(i => mappings.find(m => m.variant_id === i.variant_id)?.marketplace_id)
  if (ids.some(id => !id)) errors.push('尚有商品規格未設定賣場')
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (unique.length > 1) errors.push('訂單含不同賣場商品，需先處理拆單與代收金額')
  const market = unique.length === 1 ? markets.find(m => m.id === unique[0]) : undefined
  if (market && !market.enabled) errors.push('賣場尚未啟用')
  if (unique.length === 1 && !market) errors.push('賣場設定不存在')
  if (!store || store.id !== order.store_id || !store.is_active) errors.push('門市不存在或已停用')
  if (store && (normalized(store.store_name) !== normalized(order.store_name) || normalized(store.address) !== normalized(order.store_address))) errors.push('門市目前名稱或地址與訂單不一致，請核對')
  if (items.some(i => !Number.isSafeInteger(i.quantity) || i.quantity < 1 || !Number.isSafeInteger(i.unit_price) || i.unit_price < 0 || i.subtotal !== i.unit_price * i.quantity)) errors.push('商品數量或明細金額不一致')
  if (!Number.isSafeInteger(order.total_amount) || items.reduce((sum, i) => sum + i.subtotal, 0) !== order.total_amount) errors.push('訂單總額與商品小計不一致')
  const date = new Date(order.created_at)
  if (!Number.isFinite(date.getTime())) errors.push('訂單日期無效')
  const dateText = Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10).replace(/-/g, '/') : ''
  const goods = items.map(i => `${i.sku_snapshot ? i.sku_snapshot + ' ' : ''}${i.product_name_snapshot}（${i.variant_name_snapshot}）×${i.quantity}`).join('；')
  // 運費0沿用已授權流程；F欄完整代收原訂單總額，避免再加一次運費。
  const row: ImportRow = [order.customer_name.trim(), order.phone.trim(), store?.store_code || '', market?.temperature || '常溫', goods, String(order.total_amount), '0', dateText, order.note || '', `健康優選訂單：${order.order_no}`]
  errors.push(...validateRow(row))
  return { order_id: order.id, order_no: order.order_no, marketplace_id: market?.id || null, errors, row: errors.length ? null : row }
}

export function parseIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ROWS || value.some(v => !Number.isSafeInteger(v) || v < 1) || new Set(value).size !== value.length) throw new Error('請選擇1至500筆不重複的訂單')
  return [...value].sort((a, b) => a - b)
}

export function snapshot(order: TransferOrder) {
  const { order_items, ...header } = order
  return { order: header, items: [...order_items].sort((a, b) => a.id - b.id) }
}
