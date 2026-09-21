/**
 * 把賣貨便「批次列印」出來的面單 PDF 拆成一張一檔。
 *
 * 為什麼需要這個
 * ─────────────
 * 新比銳的桌面程式要求「一個訂單一個 PDF，檔名就是訂單號」。賣貨便一次
 * 只能印一張的話要重複十幾次「搜尋 → 取代碼 → 列印 → 另存」，而且檔名
 * 要自己打 —— 打錯不會有任何東西攔下來，面單就會配到別筆訂單的包裹上。
 * 這不是假設：使用者給的樣本裡，CM2609214719432.pdf 和
 * CM2609214719459.pdf 兩個檔案裝的是同一張面單（都是 719459）。
 *
 * 所以這裡改成：批次列印一次印完 → 丟進來 → 依面單上印的訂單號拆檔命名。
 * 檔名不再由人輸入，而是從 PDF 內容讀出來的。
 *
 * 做法
 * ────
 * 賣貨便的面單是用瀏覽器列印產生的（Skia PDF），結構單純且穩定：
 *   • 傳統 xref、沒有物件流，頁面內容是單一 FlateDecode 串流
 *   • 每個 BT…ET 文字物件剛好一個 Tm（一個位置），且自帶 Tf
 *   • 圖片（條碼）就是一個 cm + Do
 * 一張 A4 排 2×2 共 4 張面單。因為同一個 BT…ET 群組會跨格子共用繪圖
 * 狀態，沒辦法照 q…Q 區塊拆，得逐一判斷每個文字物件／圖片落在哪一格。
 *
 * 格線不是用猜的頁面比例，也不是去找裁切虛線，而是：
 *   1. 以面單上的「寄貨訂單編號：CM…」當錨點，取得每格的列與欄座標
 *   2. 相鄰錨點的距離就是格子間距（pitch）
 *   3. 把所有繪製元素的座標對 pitch 取餘數，找出「沒有任何東西」的最大
 *      空隙，切在空隙中央 —— 那就是格子邊界
 * 這樣不依賴版面尺寸，賣貨便哪天改成 3 欄或改字級也還是對的。
 *
 * 輸出的 PDF 保留整張 A4（頁首時間、頁尾網址、外框、裁切線都留著），
 * 只把其它格子的文字與條碼拿掉。刻意不裁成 10×14cm —— 使用者現在單張
 * 列印上傳成功的檔案就是整張 A4，輸出跟已知可用的格式一模一樣，風險最小。
 *
 * 產出前一定會把自己的成品再解析一次，確認裡面只剩一個訂單號而且正是
 * 預期的那一個，不符就整批中止。這條鏈路碰的是真實出貨，寧可不給檔案。
 */

import { unzlibSync, zlibSync } from 'fflate'

// ── 位元組 ↔ latin-1 字串 ──────────────────────────────
// PDF 的語法層是位元組導向的，用 latin-1 一對一對應才能安全地做字串比對
// 與切片，再轉回位元組時不會走樣。

function bytesToLatin1(b: Uint8Array): string {
  let s = ''
  const CHUNK = 0x8000
  for (let i = 0; i < b.length; i += CHUNK) {
    s += String.fromCharCode(...b.subarray(i, i + CHUNK))
  }
  return s
}

function latin1ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

// ── 矩陣 ───────────────────────────────────────────────

export type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** 先套 a 再套 b */
export function mulMatrix(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ]
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

// ── PDF 物件 ───────────────────────────────────────────

export interface PdfObject {
  /** 物件內容（不含 "N 0 obj" 與 "endobj"） */
  body: string
  /** body 在檔案中的起始位移 */
  start: number
}

export interface ParsedPdf {
  raw: Uint8Array
  text: string
  objects: Map<number, PdfObject>
  /** 目錄物件編號 */
  rootNum: number
  /** /Type /Pages 節點編號 */
  pagesNum: number
  /** 依 /Kids 順序排好的頁面物件編號 */
  pageNums: number[]
  /** trailer 的 /Size */
  size: number
  /** 原始 startxref 位移 */
  prevXref: number
  infoRef: string
}

const OBJ_RE = /(\d+)\s+(\d+)\s+obj\b/g

/**
 * 直接掃描 "N 0 obj" 建立物件表，不走 xref。
 *
 * 面單 PDF 沒有物件流也沒有 xref 串流，掃描比實作完整的 xref 解析簡單
 * 得多，而且對壞掉的 xref 更耐受。有物件流的檔案會在 parsePdf 被擋下。
 */
function scanObjects(text: string): Map<number, PdfObject> {
  const objs = new Map<number, PdfObject>()
  OBJ_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = OBJ_RE.exec(text))) {
    const num = Number(m[1])
    const start = m.index + m[0].length
    const end = text.indexOf('endobj', start)
    objs.set(num, { body: text.slice(start, end === -1 ? text.length : end), start })
  }
  return objs
}

export class LabelPdfError extends Error {}

function fail(msg: string): never {
  throw new LabelPdfError(msg)
}

export function parsePdf(raw: Uint8Array): ParsedPdf {
  const text = bytesToLatin1(raw)

  if (!text.startsWith('%PDF-')) fail('這不是 PDF 檔')
  if (text.includes('/ObjStm') || /\/Type\s*\/XRef/.test(text)) {
    fail('這份 PDF 用了壓縮物件流，目前的拆檔程式看不懂。請用賣貨便的「列印交貨便代碼」另存 PDF')
  }
  if (/\/Encrypt\b/.test(text)) fail('這份 PDF 有加密，無法拆檔')

  const objects = scanObjects(text)

  // trailer 可能出現多次（增量更新），取最後一個
  const trailerIdx = text.lastIndexOf('trailer')
  if (trailerIdx === -1) fail('PDF 缺少 trailer，檔案可能不完整')
  const trailer = text.slice(trailerIdx, trailerIdx + 400)

  const rootM = /\/Root\s+(\d+)\s+\d+\s+R/.exec(trailer)
  if (!rootM) fail('PDF 的 trailer 找不到 /Root')
  const rootNum = Number(rootM[1])

  const sizeM = /\/Size\s+(\d+)/.exec(trailer)
  const size = sizeM ? Number(sizeM[1]) : objects.size + 1

  const infoM = /\/Info\s+(\d+\s+\d+\s+R)/.exec(trailer)

  const startxrefM = /startxref\s+(\d+)\s*%%EOF\s*$/.exec(text)
  if (!startxrefM) fail('PDF 缺少 startxref，檔案可能不完整')

  const root = objects.get(rootNum)
  if (!root) fail(`PDF 的目錄物件 ${rootNum} 不存在`)
  const pagesM = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(root.body)
  if (!pagesM) fail('PDF 的目錄找不到 /Pages')
  const pagesNum = Number(pagesM[1])

  return {
    raw, text, objects, rootNum, pagesNum,
    pageNums: collectPages(objects, pagesNum),
    size,
    prevXref: Number(startxrefM[1]),
    infoRef: infoM ? infoM[1] : '',
  }
}

/** 依 /Kids 遞迴展開頁面，保留列印順序 */
function collectPages(objects: Map<number, PdfObject>, node: number, seen = new Set<number>()): number[] {
  if (seen.has(node)) return []
  seen.add(node)
  const obj = objects.get(node)
  if (!obj) return []
  if (/\/Type\s*\/Page(?![sX])/.test(obj.body)) return [node]

  const kidsM = /\/Kids\s*\[([\s\S]*?)\]/.exec(obj.body)
  if (!kidsM) return []
  const out: number[] = []
  for (const m of kidsM[1].matchAll(/(\d+)\s+\d+\s+R/g)) {
    out.push(...collectPages(objects, Number(m[1]), seen))
  }
  return out
}

// ── 串流 ───────────────────────────────────────────────

function readStream(pdf: ParsedPdf, objNum: number): Uint8Array | null {
  const obj = pdf.objects.get(objNum)
  if (!obj) return null
  const i = obj.body.indexOf('stream')
  if (i === -1) return null
  let j = i + 'stream'.length
  if (obj.body.slice(j, j + 2) === '\r\n') j += 2
  else if (obj.body[j] === '\n' || obj.body[j] === '\r') j += 1
  const k = obj.body.lastIndexOf('endstream')
  const rawStr = obj.body.slice(j, k === -1 ? obj.body.length : k)
  const bytes = latin1ToBytes(rawStr)
  if (!obj.body.slice(0, i).includes('/FlateDecode')) return bytes
  try {
    return unzlibSync(bytes)
  } catch {
    return null
  }
}

/** 頁面的 /Contents，可能是單一物件或陣列 */
function contentObjNums(pdf: ParsedPdf, pageNum: number): number[] {
  const page = pdf.objects.get(pageNum)
  if (!page) return []
  const single = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(page.body)
  if (single) return [Number(single[1])]
  const arr = /\/Contents\s*\[([\s\S]*?)\]/.exec(page.body)
  if (!arr) return []
  return [...arr[1].matchAll(/(\d+)\s+\d+\s+R/g)].map(m => Number(m[1]))
}

// ── ToUnicode ──────────────────────────────────────────

type CMap = Map<number, string>

function hexToUnicode(hex: string): string {
  let s = ''
  for (let i = 0; i + 3 < hex.length + 1; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16)
    if (!Number.isNaN(code)) s += String.fromCharCode(code)
  }
  return s
}

function parseCMap(bytes: Uint8Array): CMap {
  const txt = bytesToLatin1(bytes)
  const map: CMap = new Map()

  for (const blk of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(m[1], 16), hexToUnicode(m[2]))
    }
  }
  for (const blk of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(m[1], 16)
      const hi = Math.min(parseInt(m[2], 16), lo + 65535)
      const base = m[3]
      const head = base.slice(0, Math.max(0, base.length - 4))
      const tail = parseInt(base.slice(-4), 16)
      for (let c = lo; c <= hi; c++) {
        map.set(c, hexToUnicode(head + (tail + c - lo).toString(16).padStart(4, '0')))
      }
    }
    for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(m[1], 16)
      let i = 0
      for (const d of m[3].matchAll(/<([0-9A-Fa-f]+)>/g)) map.set(lo + i++, hexToUnicode(d[1]))
    }
  }
  return map
}

export interface FontInfo {
  cmap: CMap
  /**
   * 字碼是不是兩個位元組。
   *
   * 不能用「編碼表的鍵值有沒有超過 255」來猜 —— 面單裡的拉丁字型
   * 是 Identity-H 的 Type0，鍵值全都是 0x13、0x15 這種小數字，猜起來
   * 像單位元組，但實際上每個字佔兩個位元組。要看 /Subtype。
   */
  twoByte: boolean
}

/** 資源名（/F4…）→ 字型資訊 */
function buildFontMap(pdf: ParsedPdf, pageNum: number): Map<string, FontInfo> {
  const out = new Map<string, FontInfo>()
  const page = pdf.objects.get(pageNum)
  if (!page) return out

  let res = page.body
  const resRef = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(page.body)
  if (resRef) res = pdf.objects.get(Number(resRef[1]))?.body ?? ''

  const fontIdx = res.indexOf('/Font')
  if (fontIdx === -1) return out
  let fontDict = res.slice(fontIdx)
  const fontRef = /^\/Font\s+(\d+)\s+\d+\s+R/.exec(fontDict)
  if (fontRef) fontDict = pdf.objects.get(Number(fontRef[1]))?.body ?? ''

  for (const m of fontDict.matchAll(/\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+\d+\s+R/g)) {
    const font = pdf.objects.get(Number(m[2]))
    if (!font) continue
    const tu = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(font.body)
    if (!tu) continue
    const cmap = readStream(pdf, Number(tu[1]))
    if (cmap) out.set(m[1], { cmap: parseCMap(cmap), twoByte: /\/Subtype\s*\/Type0\b/.test(font.body) })
  }
  return out
}

// ── 內容串流掃描 ───────────────────────────────────────

/** 一個可以整塊保留或整塊丟棄的繪製單位 */
export interface DrawItem {
  kind: 'text' | 'image'
  /** 在內容串流中的位元組範圍（[start, end)） */
  start: number
  end: number
  /** 裝置座標（頁面座標，原點左下） */
  x: number
  y: number
  text: string
  /** 一個文字物件出現多個 Tm —— 歸格的前提不成立，呼叫端要擋下來 */
  multiTm?: boolean
}

const CONTENT_TOKEN =
  /(<[0-9A-Fa-f\s]*>)|(\((?:\\[\s\S]|[^()\\])*\))|(-?\d*\.\d+|-?\d+)|(\/[^\s/[\]()<>]+)|(\[|\])|([A-Za-z'"*]+)/g

/**
 * 掃出內容串流裡所有的文字物件與圖片，附上裝置座標。
 *
 * 只追蹤 q/Q/cm 與 Tm —— 這個產生器每個 BT…ET 剛好一個 Tm，不需要處理
 * Td/TD/T* 的換行推進（那些只影響同一行內的後續位移，不影響歸格）。
 * 真的遇到多個 Tm 的檔案會在 splitLabelPdf 被擋下。
 */
export function scanDrawItems(content: string, fonts: Map<string, FontInfo>): DrawItem[] {
  const items: DrawItem[] = []
  let ctm: Matrix = IDENTITY
  const stack: Matrix[] = []
  let operands: string[] = []
  let operandStarts: number[] = []

  let btStart = -1
  let tm: Matrix | null = null
  let tmCount = 0
  let font: FontInfo | undefined
  let buf = ''
  let ctmAtBt: Matrix = IDENTITY

  const decode = (tok: string): string => {
    if (!font) return ''
    let bytes: number[]
    if (tok.startsWith('<')) {
      const hex = tok.slice(1, -1).replace(/\s/g, '')
      bytes = []
      for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16))
    } else {
      bytes = []
      const body = tok.slice(1, -1)
      for (let i = 0; i < body.length; i++) {
        if (body[i] === '\\' && i + 1 < body.length) i++
        bytes.push(body.charCodeAt(i) & 0xff)
      }
    }
    let s = ''
    if (font.twoByte) {
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        s += font.cmap.get((bytes[i] << 8) | bytes[i + 1]) ?? ''
      }
    } else {
      for (const b of bytes) s += font.cmap.get(b) ?? String.fromCharCode(b)
    }
    return s
  }

  CONTENT_TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CONTENT_TOKEN.exec(content))) {
    if (!m[6]) { operands.push(m[0]); operandStarts.push(m.index); continue }
    const op = m[6]

    if (op === 'q') stack.push(ctm)
    else if (op === 'Q') ctm = stack.pop() ?? IDENTITY
    else if (op === 'cm' && operands.length >= 6) {
      ctm = mulMatrix(operands.slice(-6).map(Number) as Matrix, ctm)
    } else if (op === 'BT') {
      btStart = m.index
      tm = null; tmCount = 0; buf = ''; ctmAtBt = ctm
    } else if (op === 'Tf' && operands.length >= 2) {
      font = fonts.get(operands[operands.length - 2].slice(1))
    } else if (op === 'Tm' && operands.length >= 6) {
      tm = operands.slice(-6).map(Number) as Matrix
      tmCount++
    } else if (op === 'Tj' || op === "'" || op === '"') {
      buf += decode(operands[operands.length - 1] ?? '')
    } else if (op === 'TJ') {
      for (const t of operands) {
        if (t.startsWith('<') || t.startsWith('(')) buf += decode(t)
      }
    } else if (op === 'ET') {
      if (btStart !== -1 && tm) {
        const [x, y] = applyMatrix(mulMatrix(tm, ctmAtBt), 0, 0)
        items.push({
          kind: 'text', start: btStart, end: m.index + op.length,
          x, y, text: buf,
          // 帶出去讓呼叫端驗證「一個文字物件一個位置」的前提
          ...(tmCount > 1 ? { multiTm: true } : {}),
        })
      }
      btStart = -1; tm = null
    } else if (op === 'Do') {
      // 圖片畫在 cm 定義的單位方框裡，取中心點歸格
      const [x, y] = applyMatrix(ctm, 0.5, 0.5)
      // 連同前面的 /X9 一起刪掉，才不會留下沒有 Do 的孤兒運算元
      items.push({
        kind: 'image',
        start: operandStarts.length ? operandStarts[operandStarts.length - 1] : m.index,
        end: m.index + op.length,
        x, y, text: '',
      })
    }

    operands = []
    operandStarts = []
  }
  return items
}

// ── 格線 ───────────────────────────────────────────────

/**
 * 找出把一維座標切成格子的邊界。
 *
 * anchors 是每一格裡「同一個欄位」的座標（面單上的訂單號），所以相鄰
 * 錨點的距離就是格子間距。錨點在格子裡的位置是偏的（訂單號印在面單的
 * 下半部），不能拿錨點中點當邊界 —— 上一格的內容會伸到中點的另一側。
 *
 * 直覺的做法是把座標對間距取餘數、找最大的空白帶當裁切線，但那個做法在
 * 真實樣本上是錯的：面單內部「交貨便服務代碼」右邊有一塊 76pt 的留白，
 * 比面單之間的 59pt 間隙還寬，裁切線會落進面單裡，右緣的字元就被分到
 * 隔壁那張單。
 *
 * 改成用「每張面單的版面完全相同」這個事實 —— 它們本來就是同一個樣板
 * 印出來的。把每個座標換算成「距離各個錨點多遠」，屬於面單的偏移量一定
 * 在每個錨點底下都找得到對應的元素（因為每張面單都有那個欄位）；頁首的
 * 列印時間、頁尾的網址則只出現一次，對不上。取交集就得到面單真正的
 * 佔用範圍，裁切線再切在範圍外那段留白的正中間。
 */
const POSITION_TOLERANCE = 0.5

function keyOf(v: number): number {
  return Math.round(v / POSITION_TOLERANCE)
}

export function gridCuts(anchors: number[], positions: number[]): { pitch: number; cut: number } | null {
  const uniq = [...new Set(anchors.map(a => Math.round(a * 100) / 100))].sort((a, b) => a - b)
  if (uniq.length < 2) return null

  const gaps: number[] = []
  for (let i = 1; i < uniq.length; i++) gaps.push(uniq[i] - uniq[i - 1])
  // 同一排可能缺格（例如 4 格只印了 1、2、4），間距取最小的那個
  const pitch = Math.min(...gaps)
  if (!(pitch > 1)) return null

  const present = new Set(positions.map(keyOf))
  // 對每個錨點都找得到對應元素的偏移量，才算是面單本身的內容
  let lo = Infinity
  let hi = -Infinity
  for (const p of positions) {
    const d = p - uniq[0]
    if (uniq.every(a => present.has(keyOf(a + d)))) {
      if (d < lo) lo = d
      if (d > hi) hi = d
    }
  }
  if (!Number.isFinite(lo)) return null
  // 佔用範圍比間距還寬就代表判斷錯了，寧可不切也不要切錯
  if (hi - lo >= pitch) return null

  return { pitch, cut: uniq[0] + (lo + hi + pitch) / 2 }
}

/** 座標 p 落在第幾格（以 cut 為界，可為負） */
export function cellIndex(p: number, pitch: number, cut: number): number {
  return Math.floor((p - cut) / pitch)
}

export interface PageAnchor {
  orderNo: string
  item: DrawItem
  cell: string
}

export interface PageLayout {
  anchors: PageAnchor[]
  xCut: { pitch: number; cut: number } | null
  yCut: { pitch: number; cut: number } | null
  cellOf(i: { x: number; y: number }): string
  /** 這個元素要不要留在 cell 這張面單裡 */
  belongsTo(i: DrawItem, cell: string): boolean
}

/** 把一頁裡的繪製元素分成「哪一張面單的」 */
export function pageLayout(items: DrawItem[]): PageLayout {
  const anchorItems = items
    .map(i => ({ item: i, m: ORDER_IN_LABEL.exec(i.text) }))
    .filter((a): a is { item: DrawItem; m: RegExpExecArray } => a.m !== null)

  const xCut = gridCuts(anchorItems.map(a => a.item.x), items.map(i => i.x))
  const yCut = gridCuts(anchorItems.map(a => a.item.y), items.map(i => i.y))

  const cellOf = (i: { x: number; y: number }) =>
    `${xCut ? cellIndex(i.x, xCut.pitch, xCut.cut) : 0},${yCut ? cellIndex(i.y, yCut.pitch, yCut.cut) : 0}`

  const anchors: PageAnchor[] = anchorItems.map(a => ({
    orderNo: a.m[0], item: a.item, cell: cellOf(a.item),
  }))
  const occupied = new Set(anchors.map(a => a.cell))

  return {
    anchors, xCut, yCut, cellOf,
    // 落在沒有任何面單的格子（頁首列印時間、頁尾網址與頁碼）一律保留 ——
    // 使用者現在單張上傳成功的檔案就有這些，輸出維持一致比較保險
    belongsTo: (i, cell) => {
      const k = cellOf(i)
      return !occupied.has(k) || k === cell
    },
  }
}

// ── 主流程 ─────────────────────────────────────────────

export const ORDER_IN_LABEL = /CM\d{13}(?!\d)/

export interface SplitLabel {
  orderNo: string
  /** 第幾頁（1 起算），給對帳報告用 */
  page: number
  pdf: Uint8Array
}

export interface SplitResult {
  labels: SplitLabel[]
  warnings: string[]
}

/**
 * 拆檔主流程。回傳每張面單一份完整的 A4 PDF。
 */
export function splitLabelPdf(raw: Uint8Array): SplitResult {
  const pdf = parsePdf(raw)
  const warnings: string[] = []

  if (pdf.pageNums.length === 0) fail('PDF 裡沒有任何頁面')

  interface Pending { orderNo: string; page: number; pageNum: number; keep: (i: DrawItem) => boolean }
  const pending: Pending[] = []
  // 每一頁只解一次內容串流
  const pageContent = new Map<number, { content: string; contentObj: number; items: DrawItem[] }>()

  for (let p = 0; p < pdf.pageNums.length; p++) {
    const pageNum = pdf.pageNums[p]
    const contentObjs = contentObjNums(pdf, pageNum)
    if (contentObjs.length !== 1) {
      fail(`第 ${p + 1} 頁的內容串流不是單一物件，目前的拆檔程式看不懂這種 PDF`)
    }
    const bytes = readStream(pdf, contentObjs[0])
    if (!bytes) fail(`第 ${p + 1} 頁的內容串流解不開`)
    const content = bytesToLatin1(bytes)

    const items = scanDrawItems(content, buildFontMap(pdf, pageNum))
    if (items.some(i => i.multiTm)) {
      fail('這份 PDF 的文字物件排法跟預期不同，為了避免拆錯，請改用賣貨便原本的列印方式另存')
    }
    pageContent.set(pageNum, { content, contentObj: contentObjs[0], items })

    const layout = pageLayout(items)
    if (layout.anchors.length === 0) {
      warnings.push(`第 ${p + 1} 頁找不到訂單號，已略過`)
      continue
    }

    for (const a of layout.anchors) {
      pending.push({
        orderNo: a.orderNo,
        page: p + 1,
        pageNum,
        keep: (i: DrawItem) => layout.belongsTo(i, a.cell),
      })
    }
  }

  if (pending.length === 0) fail('這份 PDF 裡找不到任何面單（沒有「寄貨訂單編號：CM…」）')

  const labels: SplitLabel[] = []
  for (const job of pending) {
    const page = pageContent.get(job.pageNum)!
    const filtered = dropItems(page.content, page.items.filter(i => !job.keep(i)))

    const out = buildSinglePagePdf(pdf, job.pageNum, page.contentObj, filtered)

    // 交出去之前先驗自己的成品
    verifySingleOrder(out, job.orderNo)

    labels.push({ orderNo: job.orderNo, page: job.page, pdf: out })
  }

  const seen = new Map<string, number>()
  for (const l of labels) seen.set(l.orderNo, (seen.get(l.orderNo) ?? 0) + 1)
  for (const [no, n] of seen) {
    if (n > 1) warnings.push(`訂單 ${no} 在這份 PDF 裡出現 ${n} 次，只會保留最後一張`)
  }

  return { labels, warnings }
}

/** 把指定範圍從內容串流剪掉（由後往前，位移才不會跑掉） */
function dropItems(content: string, drop: DrawItem[]): string {
  const sorted = [...drop].sort((a, b) => b.start - a.start)
  let out = content
  for (const d of sorted) {
    out = out.slice(0, d.start) + out.slice(d.end)
  }
  return out
}

// ── 產出 PDF ───────────────────────────────────────────

function streamObject(num: number, data: Uint8Array): { text: string } {
  const packed = zlibSync(data, { level: 9 })
  return {
    text: `${num} 0 obj\n<</Filter /FlateDecode /Length ${packed.length}>>\nstream\n` +
      bytesToLatin1(packed) + `\nendstream\nendobj\n`,
  }
}

/**
 * 用增量更新的方式產生新檔：原始位元組原封不動，後面接上要覆寫的物件與
 * 新的 xref。這樣字型、圖片、外框全都保留原樣，只有被覆寫的那幾個物件
 * 改變，比整檔重組安全得多。
 *
 * 覆寫的是：
 *   • 目標頁的內容串流（濾掉其它格子）
 *   • 其它頁的內容串流（清空）—— 多頁批次時，避免別頁的訂單號還留在檔裡
 *   • /Pages 節點（只留目標頁）
 *   • 目錄（拿掉 /StructTreeRoot 與 /MarkInfo；內容被刪過，標記結構已經對不上）
 */
function buildSinglePagePdf(
  pdf: ParsedPdf,
  pageNum: number,
  contentObj: number,
  filtered: string,
): Uint8Array {
  const overrides = new Map<number, string>()

  overrides.set(contentObj, streamObject(contentObj, latin1ToBytes(filtered)).text)

  for (const other of pdf.pageNums) {
    if (other === pageNum) continue
    for (const c of contentObjNums(pdf, other)) {
      if (c === contentObj) continue
      overrides.set(c, streamObject(c, new Uint8Array(0)).text)
    }
  }

  overrides.set(pdf.pagesNum, `${pdf.pagesNum} 0 obj\n<</Type /Pages\n/Count 1\n/Kids [${pageNum} 0 R]>>\nendobj\n`)

  const root = pdf.objects.get(pdf.rootNum)!
  const cleanRoot = root.body
    .replace(/\/StructTreeRoot\s+\d+\s+\d+\s+R/, '')
    .replace(/\/MarkInfo\s*<<[\s\S]*?>>/, '')
  overrides.set(pdf.rootNum, `${pdf.rootNum} 0 obj\n${cleanRoot.trim()}\nendobj\n`)

  // 原始檔尾若沒有換行，補一個，免得新物件黏在 %%EOF 後面
  let out = pdf.text
  if (!out.endsWith('\n')) out += '\n'

  const offsets = new Map<number, number>()
  for (const [num, body] of [...overrides].sort((a, b) => a[0] - b[0])) {
    offsets.set(num, out.length)
    out += body
  }

  const xrefStart = out.length
  // 第一個子區段固定從 0 號（永遠存在的 free 物件）開始。增量更新其實不必
  // 重列 0 號，但有些解析器看到 xref 不是從 0 起算就會判定整張表位移了一格、
  // 自作主張把物件編號全部 -1（pypdf 實測會印出 "Xref table not zero-indexed.
  // ID numbers for objects will be corrected."）。多這 20 個位元組換掉那個猜測。
  out += 'xref\n0 1\n0000000000 65535 f \n'
  // 連號的物件併成同一個子區段
  const nums = [...offsets.keys()].sort((a, b) => a - b)
  let i = 0
  while (i < nums.length) {
    let j = i
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++
    out += `${nums[i]} ${j - i + 1}\n`
    for (let k = i; k <= j; k++) {
      out += `${String(offsets.get(nums[k])).padStart(10, '0')} 00000 n \n`
    }
    i = j + 1
  }

  out += `trailer\n<</Size ${pdf.size}\n/Root ${pdf.rootNum} 0 R\n` +
    (pdf.infoRef ? `/Info ${pdf.infoRef}\n` : '') +
    `/Prev ${pdf.prevXref}>>\nstartxref\n${xrefStart}\n%%EOF\n`

  return latin1ToBytes(out)
}

// ── 自我驗證 ───────────────────────────────────────────

/**
 * 把剛做好的 PDF 再解析一次，確認頁面裡只剩一個訂單號而且正是預期的那個。
 *
 * 沒有這一段，拆錯格子的後果是「看起來很正常、但配到別筆訂單的面單」——
 * 那種錯誤要等包裹寄到錯的人手上才會發現。寧可整批中止。
 */
export function verifySingleOrder(out: Uint8Array, expected: string): void {
  const re = parsePdf(out)
  if (re.pageNums.length !== 1) {
    fail(`產出的 ${expected}.pdf 有 ${re.pageNums.length} 頁，預期 1 頁`)
  }
  const objs = contentObjNums(re, re.pageNums[0])
  const bytes = objs.length === 1 ? readStream(re, objs[0]) : null
  if (!bytes) fail(`產出的 ${expected}.pdf 讀不回內容`)

  const text = scanDrawItems(bytesToLatin1(bytes), buildFontMap(re, re.pageNums[0]))
    .map(i => i.text).join('\n')

  const found = [...new Set([...text.matchAll(/CM\d{13}(?!\d)/g)].map(m => m[0]))]
  if (found.length !== 1 || found[0] !== expected) {
    fail(`產出的 ${expected}.pdf 內容對不上（裡面是 ${found.join('、') || '空的'}），已中止`)
  }
}

// ── 檔名 ───────────────────────────────────────────────

/** 新比銳要求檔名就是訂單號 */
export function labelFileName(orderNo: string): string {
  return `${orderNo}.pdf`
}
