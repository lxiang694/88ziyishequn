/**
 * 快速下單：把 Line 私訊貼上的一段文字拆成訂單欄位。
 *
 * 固定格式（依序）：收件人 / 手機 / 門市 / 商品規格與數量
 *
 *   張三 0972720032 慶平  20mg 葉黃素軟膠囊X2
 *
 * 換行版本也吃得下 —— 客戶在 Line 上常常是一行一個欄位：
 *
 *   張三
 *   0972720032
 *   慶平
 *   20mg 葉黃素軟膠囊X2
 *
 * ── 為什麼用手機號碼當錨點 ──────────────────────────────
 * 姓名可能有空格（英文名、原住民姓名的「·」），商品名稱裡一定有空格
 * （「20mg 葉黃素軟膠囊」），所以「照空白切成四段」一定會壞。
 * 台灣手機 09xxxxxxxx 的格式是全段文字裡唯一不會認錯的東西，
 * 先找到它，前面就是姓名，後面就是門市與商品。
 *
 * ── 這裡只負責拆字串 ────────────────────────────────────
 * 比對商品、比對門市、建立訂單都不在這一層。這個檔案是純函式，
 * 沒有資料庫、沒有網路，壞掉的時候測試會直接告訴你壞在哪一行。
 */

export interface ParsedItem {
  /** 原始文字，例如「20mg 葉黃素軟膠囊」 */
  raw: string
  quantity: number
}

export interface ParsedOrder {
  customer_name: string
  phone: string
  /** 門市關鍵字，例如「慶平」。還沒對到資料庫 */
  store_query: string
  items: ParsedItem[]
  /** 給人看的提醒，不是錯誤；有內容時畫面要顯示出來 */
  warnings: string[]
}

/** 全形英數與常見全形符號轉半形；中文不動 */
export function toHalfWidth(input: string): string {
  return input
    .replace(/[！-～]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')   // 全形空白
    .replace(/ /g, ' ')   // 不斷行空白，從網頁複製常帶進來
}

/**
 * 把被分隔符切開的手機號碼接回去。
 *
 * 客戶寫 0972-720032 或 0972 720032 都很常見。不先接回來，
 * 後面用 09\d{8} 就找不到，整段解析會從第一步就錯。
 */
export function joinPhoneDigits(input: string): string {
  return input.replace(
    /(09)[\s-]?(\d{2})[\s-]?(\d{3})[\s-]?(\d{3})(?!\d)/g,
    '$1$2$3$4',
  )
}

const PHONE_RE = /09\d{8}/

/**
 * 數量寫法。兩種都吃：
 *   X2 / x2 / ×2 / *2 / ＊2   （最常見）
 *   2瓶 / 2盒 / 2罐 …          （口語）
 *
 * 單位清單刻意保守。「粒」「顆」「ml」「mg」不列入 ——
 * 「30粒裝」「500ml」是規格的一部分，當成數量會直接下錯單。
 */
const QTY_MARK_RE = /[xX×＊*]\s*(\d{1,3})(?=\s|$|[,、，+])/
const QTY_UNIT_RE = /(\d{1,3})\s*(?:瓶|盒|包|罐|組|入|件|支)(?=\s|$|[,、，+])/

/** 商品之間的分隔：換行、頓號、逗號、加號 */
const ITEM_SPLIT_RE = /[\n、,，+]+/

const MAX_ITEMS = 20
const MAX_QTY = 999

/**
 * 把一段商品文字拆成品項。
 *
 * 先照分隔符切，再對每一段找數量。沒寫數量的當成 1 ——
 * 客戶寫「葉黃素」就是要一瓶，不該因此擋下整張單。
 */
export function parseItems(text: string): ParsedItem[] {
  const out: ParsedItem[] = []

  for (const chunk of text.split(ITEM_SPLIT_RE)) {
    const seg = chunk.trim()
    if (!seg) continue

    // 同一段裡可能有多個 X 數量（「葉黃素X2 紫蘇油X1」中間只有空白），
    // 所以要反覆掃，掃完一個就把它從字串前面切掉。
    let rest = seg
    let guard = 0
    while (rest.trim() && guard++ < MAX_ITEMS) {
      const mark = QTY_MARK_RE.exec(rest)
      if (mark && mark.index !== undefined) {
        const name = rest.slice(0, mark.index).trim()
        const qty = Number(mark[1])
        if (name) out.push({ raw: name, quantity: clampQty(qty) })
        rest = rest.slice(mark.index + mark[0].length)
        continue
      }

      const unit = QTY_UNIT_RE.exec(rest)
      if (unit && unit.index !== undefined) {
        const name = rest.slice(0, unit.index).trim()
        const qty = Number(unit[1])
        if (name) out.push({ raw: name, quantity: clampQty(qty) })
        rest = rest.slice(unit.index + unit[0].length)
        continue
      }

      // 剩下的沒有數量標記 → 整段是一個品項，數量 1
      const name = rest.trim()
      if (name) out.push({ raw: name, quantity: 1 })
      break
    }
  }

  return out.slice(0, MAX_ITEMS)
}

function clampQty(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(Math.floor(n), MAX_QTY)
}

/**
 * 主要進入點。
 *
 * 解析不出來的欄位一律留空字串，並在 warnings 說明，
 * **不要用猜的補上** —— 這段文字最後會變成真的訂單，
 * 猜錯的是別人的地址跟電話。
 */
export function parseQuickOrder(input: string): ParsedOrder {
  const warnings: string[] = []
  const text = joinPhoneDigits(toHalfWidth(input || '')).trim()

  if (!text) {
    return { customer_name: '', phone: '', store_query: '', items: [], warnings: ['沒有內容'] }
  }

  const m = PHONE_RE.exec(text)
  if (!m) {
    return {
      customer_name: '', phone: '', store_query: '', items: [],
      warnings: ['找不到手機號碼（要像 0972720032 這樣的 09 開頭 10 碼）'],
    }
  }

  const phone = m[0]
  const before = text.slice(0, m.index)
  const after = text.slice(m.index + phone.length)

  // 姓名：手機前面的最後一個非空行。前面若還有別的行（例如客戶先
  // 打了一句「老師我要訂」），那些不是姓名，丟掉。
  const beforeLines = before.split('\n').map(s => s.trim()).filter(Boolean)
  const customer_name = beforeLines.length > 0 ? beforeLines[beforeLines.length - 1] : ''
  if (!customer_name) warnings.push('手機號碼前面沒有姓名')
  if (beforeLines.length > 1) {
    warnings.push(`姓名取「${customer_name}」，前面還有其他文字已忽略`)
  }

  // 門市：手機後面的第一個詞（空白或換行切開）。
  // 7-11 門市名稱是單一詞，不含空白，所以這條規則對單行與換行都成立。
  const afterTrimmed = after.replace(/^[\s\n]+/, '')
  const sep = afterTrimmed.search(/[\s\n]/)
  const store_query = sep === -1 ? afterTrimmed : afterTrimmed.slice(0, sep)
  const itemText = sep === -1 ? '' : afterTrimmed.slice(sep)

  if (!store_query) warnings.push('手機號碼後面沒有門市名稱')

  const items = parseItems(itemText)
  if (items.length === 0) warnings.push('沒有解析到商品')

  return { customer_name, phone, store_query, items, warnings }
}
