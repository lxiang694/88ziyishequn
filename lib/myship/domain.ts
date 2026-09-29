export const MAX_ROWS = 500

/**
 * 賣貨便賣場代碼格式（與 myship_marketplaces.id 的 CHECK 條件一致）。
 *
 * 賣場代碼出現在網址上，例如
 *   https://myship.7-11.com.tw/general/detail/GM2604107313905
 *
 * 用格式檢查取代寫死某一個代碼 —— 真正「這個賣場能不能用」由資料庫的
 * myship_marketplaces 決定（enabled 欄位），不由程式碼裡的常數決定。
 */
export const MARKETPLACE_ID_PATTERN = /^GM\d{6,20}$/
export function isMarketplaceId(value: unknown): value is string {
  return typeof value === 'string' && MARKETPLACE_ID_PATTERN.test(value)
}

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
  /**
   * 拆單序號。一張訂單的商品分屬幾個賣場，就拆成幾張賣貨便訂單，
   * 每張各自匯出、各自代收。沒有拆單時 part = parts = 1。
   */
  part: number
  parts: number
  /** 這一張要代收的金額（該賣場商品的小計加總） */
  amount: number
}

/** 賣貨便一次最多拆成幾張。實際上兩三個賣場已經很多，這是防呆上限。 */
export const MAX_PARTS = 9

/**
 * 寫在匯入檔「其他資訊」欄的原單標記。
 *
 * 沒拆單時維持原本的格式，既有批次、結果檔比對完全不受影響。拆單時
 * 加上（1/2）這種序號 —— 賣貨便後台會出現兩張收件人、門市都一樣的
 * 訂單，沒有序號的話，看的人只會以為重複下單了。
 */
export function orderMarker(orderNo: string, part: number, parts: number): string {
  return parts > 1 ? `健康優選訂單：${orderNo}（${part}/${parts}）` : `健康優選訂單：${orderNo}`
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

const goodsText = (items: TransferItem[]) =>
  items.map(i => `${i.sku_snapshot ? i.sku_snapshot + ' ' : ''}${i.product_name_snapshot}（${i.variant_name_snapshot}）×${i.quantity}`).join('；')

/**
 * 把一張健康優選訂單整理成要匯入賣貨便的一或多列。
 *
 * 商品全在同一個賣場：一列，跟以前完全一樣。
 * 商品分屬多個賣場：每個賣場一列，各自代收各自商品的小計。
 *
 * 代收金額可以乾淨地拆，是因為下面已經驗過「訂單總額 ＝ 商品小計加總」
 * （沒有另計的運費或折扣）。所以每張的金額就是它那些商品的小計，全部
 * 加起來必定等於原訂單總額，沒有分攤或四捨五入的問題。
 *
 * 只要任何一張匯不出去（例如拆完只剩 40 元，低於賣貨便下限 55 元），
 * 整張訂單的每一張都不給匯出。只寄出一半、另一半永遠寄不出去的訂單，
 * 比整張卡住還難收拾 —— 客人會收到不完整的貨，還搞不清楚剩下的呢。
 */
export function prepareOrderParts(order: TransferOrder, mappings: Mapping[], markets: Marketplace[], store?: PickupStore): PreparedOrder[] {
  const common: string[] = []
  if (order.order_status !== '待確認') common.push('訂單已不是待確認')
  const items = [...(order.order_items || [])].sort((a, b) => a.id - b.id)
  if (!items.length) common.push('訂單沒有商品明細')
  if (!store || store.id !== order.store_id || !store.is_active) common.push('門市不存在或已停用')
  if (store && (normalized(store.store_name) !== normalized(order.store_name) || normalized(store.address) !== normalized(order.store_address))) common.push('門市目前名稱或地址與訂單不一致，請核對')
  if (items.some(i => !Number.isSafeInteger(i.quantity) || i.quantity < 1 || !Number.isSafeInteger(i.unit_price) || i.unit_price < 0 || i.subtotal !== i.unit_price * i.quantity)) common.push('商品數量或明細金額不一致')
  if (!Number.isSafeInteger(order.total_amount) || items.reduce((sum, i) => sum + i.subtotal, 0) !== order.total_amount) common.push('訂單總額與商品小計不一致')
  const date = new Date(order.created_at)
  if (!Number.isFinite(date.getTime())) common.push('訂單日期無效')
  const dateText = Number.isFinite(date.getTime()) ? new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10).replace(/-/g, '/') : ''

  const base = { order_id: order.id, order_no: order.order_no }
  const marketOf = (i: TransferItem) => mappings.find(m => m.variant_id === i.variant_id)?.marketplace_id

  // 有商品還沒設定賣場時沒辦法決定怎麼拆，整張當一筆回報，行為跟以前一樣
  if (items.some(i => !marketOf(i))) {
    const known = [...new Set(items.map(marketOf).filter((id): id is string => !!id))]
    return [{ ...base, marketplace_id: known.length === 1 ? known[0] : null,
      errors: [...common, '尚有商品規格未設定賣場'], row: null,
      part: 1, parts: 1, amount: order.total_amount }]
  }

  // 依商品第一次出現的順序分組（商品已按 id 排序），拆單序號因此每次都一樣。
  // 這很重要：序號寫在匯入檔裡，清單、建立批次、比對結果三個時間點算出來的
  // 必須完全相同，否則結果檔會對不上。
  const groups: { market: string; items: TransferItem[] }[] = []
  for (const i of items) {
    const m = marketOf(i)!
    const g = groups.find(x => x.market === m)
    if (g) g.items.push(i)
    else groups.push({ market: m, items: [i] })
  }
  const parts = groups.length

  if (parts > MAX_PARTS) {
    return [{ ...base, marketplace_id: null, errors: [...common, `訂單商品分屬 ${parts} 個賣場，超過可拆單上限 ${MAX_PARTS}`],
      row: null, part: 1, parts: 1, amount: order.total_amount }]
  }

  const prepared = groups.map((g, index) => {
    const part = index + 1
    const market = markets.find(m => m.id === g.market)
    const label = parts > 1 ? `第${part}張（${market?.name || g.market}）：` : ''
    const errors: string[] = []
    if (!market) errors.push(label + '賣場設定不存在')
    else if (!market.enabled) errors.push(label + '賣場尚未啟用')
    const amount = g.items.reduce((sum, i) => sum + i.subtotal, 0)
    // 運費0沿用已授權流程；F欄完整代收這一張的商品金額，避免再加一次運費。
    const row: ImportRow = [order.customer_name.trim(), order.phone.trim(), store?.store_code || '', market?.temperature || '常溫',
      goodsText(g.items), String(amount), '0', dateText, order.note || '', orderMarker(order.order_no, part, parts)]
    errors.push(...validateRow(row).map(e => label + e))
    return { market: g.market, part, amount, row, errors }
  })

  // 防呆：各張金額加總必須剛好等於原訂單總額。上面已驗過總額＝小計加總，
  // 分組又是對商品做完整分割，理論上一定成立；這裡再驗一次，因為代收金額
  // 算錯就是向客人多收或少收錢。
  const splitTotal = prepared.reduce((sum, p) => sum + p.amount, 0)
  const integrity = parts > 1 && splitTotal !== order.total_amount
    ? [`拆單後代收加總 ${splitTotal} 與訂單總額 ${order.total_amount} 不符`] : []

  // 任何一張有問題，每一張都不給匯出（原因見函式說明）
  const allErrors = [...new Set([...common, ...integrity, ...prepared.flatMap(p => p.errors)])]

  return prepared.map(p => ({
    ...base,
    marketplace_id: p.market,
    errors: allErrors,
    row: allErrors.length ? null : p.row,
    part: p.part,
    parts,
    amount: p.amount,
  }))
}

/**
 * 單一賣場訂單的便利函式。拆單訂單請改用 prepareOrderParts。
 *
 * 保留它是因為既有的測試與呼叫端大多只處理單一賣場；拆單訂單在這裡只會
 * 回傳第一張，所以呼叫端若可能遇到拆單，一定要用 prepareOrderParts。
 */
export function prepareOrder(order: TransferOrder, mappings: Mapping[], markets: Marketplace[], store?: PickupStore): PreparedOrder {
  return prepareOrderParts(order, mappings, markets, store)[0]
}

export function parseIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ROWS || value.some(v => !Number.isSafeInteger(v) || v < 1) || new Set(value).size !== value.length) throw new Error('請選擇1至500筆不重複的訂單')
  return [...value].sort((a, b) => a - b)
}

export function snapshot(order: TransferOrder) {
  const { order_items, ...header } = order
  return { order: header, items: [...order_items].sort((a, b) => a.id - b.id) }
}
