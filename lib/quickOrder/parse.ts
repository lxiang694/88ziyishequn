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
 * ── 有標籤、順序亂的訊息 ────────────────────────────────
 * 客戶從 Line 複製過來的常常不照順序，還帶著標籤與門市地址：
 *
 *   7-11 科建門市 ： 台北市大安區建國南路一段28、30號
 *   收件人： 黃國榮
 *   電話：0938960511
 *
 * 只要出現「收件人：」「電話：」「門市：」這類標籤，或「○○門市」的寫法，
 * 就改用逐行辨識（parseLabeled），不管順序；門市後面的地址留下來，
 * 同名門市有好幾家時拿來挑對的那一家。沒有任何標籤時維持原本的
 * 固定順序解析，行為完全不變。
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
  /** 門市關鍵字，例如「慶平」，或 6 碼店號。還沒對到資料庫 */
  store_query: string
  /** 訊息裡附的門市地址（沒有就是空字串）。同名門市有好幾家時用來挑對的 */
  store_address: string
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
    return { customer_name: '', phone: '', store_query: '', store_address: '', items: [], warnings: ['沒有內容'] }
  }

  // 有標籤或「○○門市」寫法 → 逐行辨識，不管順序
  const labeled = parseLabeled(text)
  if (labeled) return labeled

  const m = PHONE_RE.exec(text)
  if (!m) {
    return {
      customer_name: '', phone: '', store_query: '', store_address: '', items: [],
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

  return { customer_name, phone, store_query, store_address: '', items, warnings }
}

// ── 有標籤的訊息 ─────────────────────────────────────────

const NAME_LABELS = ['收件人姓名', '收件人', '取件人', '收貨人', '領貨人', '訂購人', '聯絡人', '姓名', '名字', '大名']
const PHONE_LABELS = ['手機號碼', '聯絡電話', '連絡電話', '電話號碼', '手機', '電話', 'tel', 'phone']
const STORE_LABELS = ['取貨門市', '取件門市', '收件門市', '門市名稱', '門市店號', '門市', '店名', '店號']
const ADDRESS_LABELS = ['門市地址', '地址']
const ITEM_LABELS = ['訂購商品', '購買商品', '訂購內容', '訂單內容', '商品', '品項']

const ALL_LABELS = [...NAME_LABELS, ...PHONE_LABELS, ...STORE_LABELS, ...ADDRESS_LABELS, ...ITEM_LABELS]
  .sort((a, b) => b.length - a.length)   // 長的先比，「收件人姓名」不會被「收件人」吃掉
const LABEL_RE = new RegExp(`^(${ALL_LABELS.join('|')})(?:\\s*:\\s*|\\s+)(.*)$`, 'i')
/** 同一行裡有好幾個「標籤：」時，在標籤前面斷行 */
const INLINE_LABEL_RE = new RegExp(`\\s+(?=(?:${ALL_LABELS.join('|')})\\s*:)`, 'gi')

/** 「7-11 科建門市」「科建門市」「統一超商 科建門市」 */
const STORE_PATTERN_RE = /(?:^|\s)(?:7-?11|7-eleven|711|統一超商|小七)?\s*([^\s:]{1,12}?)門市/i
/** 6 碼店號 */
const STORE_CODE_RE = /^\d{6}$/
/** 看起來像地址：有縣市，後面有區鄉鎮市 */
const ADDRESS_RE = /[一-鿿]{1,3}[縣市][一-鿿]{1,4}[區鄉鎮市]/
/** 像人名：2～5 個中文字（可含「·」），或英文名 */
const NAME_LIKE_RE = /^(?:[一-鿿·‧・]{2,5}|[A-Za-z][A-Za-z .'-]{1,30})$/
/** 客套話與開場白，不是商品也不是姓名 */
const CHATTER_RE = /^(?:老師|您好|你好|哈囉|嗨|hi|hello|謝謝|感謝|麻煩|請問|我要訂|我要買|我想訂|我想買|幫我|下單|以下|如下|訂購資料|訂單資料|收件資料|寄件資料)/i

function labelKind(label: string): 'name' | 'phone' | 'store' | 'address' | 'items' {
  const l = label.toLowerCase()
  if (NAME_LABELS.includes(l)) return 'name'
  if (PHONE_LABELS.includes(l)) return 'phone'
  if (STORE_LABELS.includes(l)) return 'store'
  if (ADDRESS_LABELS.includes(l)) return 'address'
  return 'items'
}

/** 門市欄位的值可能是「科建門市 台北市大安區…」：拆成門市名稱與地址 */
function splitStoreValue(value: string): { store: string; address: string } {
  const v = value.replace(/^[:\s]+/, '').trim()
  const addr = ADDRESS_RE.exec(v)
  if (addr && addr.index > 0) {
    return { store: v.slice(0, addr.index).replace(/[\s:,，、]+$/, '').trim(), address: v.slice(addr.index).trim() }
  }
  if (addr && addr.index === 0) return { store: '', address: v }
  return { store: v.split(/\s+/)[0] || '', address: '' }
}

/** 門市名稱去掉「7-11」「門市」這類字，只留下名稱本身 */
function cleanStoreName(name: string): string {
  return name
    .replace(/^(?:7-?11|7-eleven|711|統一超商|小七)\s*/i, '')
    // 「寄到慶平門市」「在慶平門市取貨」
    .replace(/^(?:寄到|送到|寄|送|到|在|取貨|取件)/, '')
    .replace(/(?:門市|門店)$/, '')
    .trim()
}

/**
 * 有標籤（「收件人：」「電話：」…）或「○○門市」寫法的訊息。
 * 沒有任何這類線索時回傳 null，交給原本的固定順序解析。
 */
export function parseLabeled(text: string): ParsedOrder | null {
  const lines = text
    .split('\n')
    .flatMap(line => line.replace(INLINE_LABEL_RE, '\n').split('\n'))
    .map(l => l.trim())
    .filter(Boolean)

  const hasLabel = lines.some(l => LABEL_RE.test(l))
  const hasStorePattern = lines.some(l => STORE_PATTERN_RE.test(l))
  if (!hasLabel && !hasStorePattern) return null

  let name = '', phone = '', store = '', address = ''
  const itemTexts: string[] = []
  const leftovers: string[] = []
  // 緊貼在手機前面的字，跟原本固定格式的「姓名 手機」一樣可靠，選它當姓名不必再提醒
  const beforePhone = new Set<string>()

  for (const line of lines) {
    const lm = LABEL_RE.exec(line)
    if (lm) {
      const value = lm[2].trim()
      switch (labelKind(lm[1])) {
        case 'name': if (!name) name = value.replace(PHONE_RE, '').trim(); if (!phone) phone = PHONE_RE.exec(value)?.[0] || ''; break
        case 'phone': if (!phone) phone = PHONE_RE.exec(value)?.[0] || ''; break
        case 'address': if (!address) address = value; break
        case 'items': if (value) itemTexts.push(value); break
        case 'store': {
          const sv = splitStoreValue(value)
          if (!store && sv.store) store = cleanStoreName(sv.store)
          if (!address && sv.address) address = sv.address
          break
        }
      }
      continue
    }

    // 「○○門市」可能跟姓名、手機、商品寫在同一行（張三 0972720032 慶平門市 葉黃素X2），
    // 所以只把門市那一段抽出來，剩下的字繼續往下判斷
    let rest = line
    const sm = STORE_PATTERN_RE.exec(rest)
    if (sm && !store) {
      store = cleanStoreName(sm[1])
      const before = rest.slice(0, sm.index)
      const after = rest.slice(sm.index + sm[0].length).replace(/^[\s:]+/, '')
      if (!address && ADDRESS_RE.test(after)) { address = after.trim(); rest = before }
      else rest = `${before} ${after}`
      rest = rest.trim()
      if (!rest) continue
    }

    // 沒有標籤、但有手機的行：手機前面當姓名候選，其餘留給後面判斷
    const pm = PHONE_RE.exec(rest)
    if (pm) {
      if (!phone) phone = pm[0]
      const before = rest.slice(0, pm.index).trim()
      const after = rest.slice(pm.index + pm[0].length).trim()
      if (before) { leftovers.push(before); beforePhone.add(before) }
      if (after) leftovers.push(after)
      continue
    }

    // 單獨一行的地址（門市地址寫在下一行）
    if (!address && ADDRESS_RE.test(rest) && /[路街道巷號]/.test(rest)) { address = rest; continue }

    leftovers.push(rest)
  }

  const warnings: string[] = []
  const bareLabels = new Set(ALL_LABELS.map(l => l.toLowerCase()))
  for (const line of leftovers) {
    if (CHATTER_RE.test(line)) continue
    if (bareLabels.has(line.replace(/[:\s]/g, '').toLowerCase())) continue
    if (!name && NAME_LIKE_RE.test(line)) {
      name = line
      if (!beforePhone.has(line)) warnings.push(`姓名取「${line}」（訊息裡沒有標示收件人），請確認`)
      continue
    }
    if (!store && STORE_CODE_RE.test(line)) { store = line; continue }
    itemTexts.push(line)
  }

  if (!phone) warnings.push('找不到手機號碼（要像 0972720032 這樣的 09 開頭 10 碼）')
  if (!name) warnings.push('找不到收件人姓名')
  if (!store && !address) warnings.push('找不到門市名稱')
  else if (!store) warnings.push('只找到門市地址，已用地址搜尋門市，請確認')

  const items = parseItems(itemTexts.join('\n'))
  if (items.length === 0) warnings.push('沒有解析到商品，請按「手動加商品」')

  return { customer_name: name, phone, store_query: store, store_address: address, items, warnings }
}
