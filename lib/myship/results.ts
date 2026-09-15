import { DOMParser, type Element } from '@xmldom/xmldom'
import { unzipSync, strFromU8 } from 'fflate'
import { validateRow, type ImportRow } from './domain'

export const MAX_RESULT_BYTES = 2_000_000
export const RESULT_HEADERS = ['*取件人姓名', '*取件人手機', '*取件門市', '*溫層', '*商品', '*訂單金額', '*運費金額', '買家下訂日期', '商品備註', '其他資訊\n(FB/LINE/IG帳號)', '訂單編號']
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const elements = (node: Element, name: string) => Array.from(node.getElementsByTagNameNS(NS, name))
const cleanHeader = (s: string) => s.replace(/\s/g, '')
const orderMarker = /^健康優選訂單：(TW[0-9]+)$/
export type ResultRow = { row: ImportRow; external_order_no: string; sheet_row: number }
export type ResultTransfer = { id: string; order_id: number | null; import_row: string[]; status: string; external_order_no: string | null }

/** Only read bounded OOXML values. Never evaluate formulas, VBA, links or workbook instructions. */
export function parseResultWorkbook(bytes: Uint8Array): ResultRow[] {
  if (!bytes.length || bytes.length > MAX_RESULT_BYTES) throw new Error('結果檔需為2 MB以內的Excel檔案')
  let count = 0, total = 0
  const names = new Set<string>()
  const files = unzipSync(bytes, { filter: file => {
    if (names.has(file.name)) throw new Error('結果檔包含重複部件')
    names.add(file.name)
    if (++count > 100 || (total += file.originalSize) > 8_000_000 || file.originalSize > 4_000_000) throw new Error('結果檔解壓後過大')
    return /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(file.name)
  } })
  const xml = (name: string) => {
    const text = strFromU8(files[name])
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('結果檔包含不支援的XML定義')
    return new DOMParser({ onError: () => { throw new Error('結果檔XML格式錯誤') } }).parseFromString(text, 'application/xml').documentElement!
  }
  const sheets = Object.keys(files).filter(n => n.startsWith('xl/worksheets/'))
  if (sheets.length !== 1) throw new Error('請使用賣貨便下載的單一工作表匯入結果')
  const shared = files['xl/sharedStrings.xml'] ? elements(xml('xl/sharedStrings.xml'), 'si').map(si => elements(si, 't').map(t => t.textContent || '').join('')) : []
  const root = xml(sheets[0])
  if (root.localName !== 'worksheet' || root.namespaceURI !== NS) throw new Error('結果工作表格式不符')
  const cellValue = (cell: Element) => {
    if (elements(cell, 'f').length) throw new Error('結果檔不可含有公式')
    const type = cell.getAttribute('t')
    const values = elements(cell, 'v')
    if (values.length > 1) throw new Error('結果儲存格格式錯誤')
    const raw = values[0]?.textContent || ''
    if (type === 's') {
      if (!/^\d+$/.test(raw) || shared[Number(raw)] === undefined) throw new Error('結果檔文字索引錯誤')
      return shared[Number(raw)]
    }
    if (type === 'inlineStr') return elements(cell, 't').map(t => t.textContent || '').join('')
    if (type && type !== 'n' && type !== 'str') throw new Error('結果檔包含不支援的儲存格類型')
    return raw
  }
  const rows = elements(root, 'row')
  if (rows.length < 2 || rows.length > 501) throw new Error('結果檔需包含1至500筆資料')
  const seenRows = new Set<number>()
  const matrix = rows.map(node => {
    const number = Number(node.getAttribute('r'))
    if (!Number.isInteger(number) || number < 1 || number > 501 || seenRows.has(number)) throw new Error('結果列號格式錯誤')
    seenRows.add(number)
    const row = Array<string>(11).fill(''), seen = new Set<string>()
    for (const cell of elements(node, 'c')) {
      const ref = cell.getAttribute('r') || ''
      const match = /^([A-K])([0-9]+)$/.exec(ref)
      if (!match || Number(match[2]) !== number || seen.has(ref)) throw new Error('結果欄位位置不符')
      seen.add(ref)
      const value = cellValue(cell)
      if (value.length > 2000) throw new Error('結果欄位文字過長')
      row[match[1].charCodeAt(0) - 65] = value.replace(/\r\n?/g, '\n')
    }
    return { number, row }
  }).sort((a, b) => a.number - b.number)
  if (matrix[0].number !== 1 || matrix[0].row.some((v, i) => cleanHeader(v) !== cleanHeader(RESULT_HEADERS[i]))) throw new Error('結果欄位尚未支援，請使用賣貨便的「下載匯入結果」檔案')
  return matrix.slice(1).filter(r => r.row.some(Boolean)).map(({ row, number }) => ({ row: row.slice(0, 10) as ImportRow, external_order_no: row[10], sheet_row: number }))
}

const field = (value: string, index: number) => {
  if (index === 7 && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) return value.split('/').map(Number).join('/')
  return value.replace(/\r\n?/g, '\n')
}

/** Validate the entire file before any write. Row order and customer name are never matching keys. */
export function matchResultRows(rows: ResultRow[], transfers: ResultTransfer[]) {
  if (!rows.length || !transfers.length || transfers.length > 500) throw new Error('沒有可核對的批次資料')
  const byMarker = new Map<string, ResultTransfer>()
  for (const t of transfers) {
    const marker = t.import_row[9]
    if (!orderMarker.test(marker) || byMarker.has(marker)) throw new Error('批次缺少唯一的健康優選原單號')
    byMarker.set(marker, t)
  }
  const seen = new Set<string>(), numbers = new Set<string>()
  const confirmed: { transfer_id: string; order_no: string; external_order_no: string }[] = []
  const unresolved: { order_no: string; reason: string }[] = []
  for (const result of rows) {
    const marker = result.row[9], match = orderMarker.exec(marker), transfer = byMarker.get(marker)
    if (!match || !transfer || seen.has(marker)) throw new Error('結果包含其他批次、重複或缺少原單號的訂單，尚未回寫')
    seen.add(marker)
    if (!transfer.order_id || transfer.status === 'released') throw new Error(`${match[1]}：原訂單不存在或已解除保留，尚未回寫`)
    if (validateRow(result.row).length || result.row.some((v, i) => field(v, i) !== field(transfer.import_row[i], i))) throw new Error(`${match[1]}：收件資料、商品或金額與原批次不符，尚未回寫`)
    const external = result.external_order_no
    if (!/^CM\d{13}$/.test(external)) {
      unresolved.push({ order_no: match[1], reason: '結果沒有有效的CM成功編號，保留待核對' })
      continue
    }
    if (numbers.has(external)) throw new Error('結果出現重複的賣貨便編號，尚未回寫')
    numbers.add(external)
    if (transfer.status === 'confirmed' && transfer.external_order_no !== external) throw new Error(`${match[1]}：已有不同的賣貨便編號，尚未回寫`)
    confirmed.push({ transfer_id: transfer.id, order_no: match[1], external_order_no: external })
  }
  for (const t of transfers) if (t.status === 'exported' && !seen.has(t.import_row[9])) unresolved.push({ order_no: t.import_row[9].slice('健康優選訂單：'.length), reason: '本次結果沒有這筆訂單，保留待核對' })
  return { confirmed, unresolved }
}
