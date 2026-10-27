import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { MAX_ROWS, validateRow, type ImportRow } from './domain'

// 賣貨便 2026-10 改版的 1.5 版範本（「填寫說明」B1＝1.5；姓名改為最少 2 字）。
// 1.4 版上傳會被賣貨便擋下：「該範本檔不是最新版本」。
// 範本來源：賣貨便訂單匯入頁「下載範例檔」，已移除填寫範例以外的資料列與存檔者名稱，其餘原樣保留。
const TEMPLATE_FILE = 'assets/myship/order-import-v1.5.xlsm'
const TEMPLATE_SHA256 = 'cb42db06f55aa5f9be75040651bdf89bd96186722b4148830c1cad2dc82821e5'
// 資料列的儲存格樣式：1.5 範本裡「文字格式」的資料儲存格（numFmtId 49）
const DATA_CELL_STYLE = '24'
// 2026-09-10 實際匯入頁標示 2 MB；以十進位位元組數保守限制。
const MAX_IMPORT_BYTES = 2_000_000
const xmlText = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** 精確保留官方 XLSM 部件，僅在訂單匯入工作表增加資料列；不執行 VBA。 */
export function fillOfficialTemplate(template: Uint8Array, rows: ImportRow[]): Uint8Array {
  if (createHash('sha256').update(template).digest('hex') !== TEMPLATE_SHA256) throw new Error('官方範本版本不符，請先核對範本')
  if (!rows.length || rows.length > MAX_ROWS) throw new Error('每個檔案需包含1至500筆訂單')
  for (const row of rows) {
    const errors = validateRow(row)
    if (errors.length) throw new Error(errors.join('；'))
  }
  const files = unzipSync(template)
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
  if (!sheet.includes('<dimension ref="A1:K6"/>') || !sheet.includes('</sheetData>')) throw new Error('範本工作表結構不符')
  const data = rows.map((row, i) => `<row r="${i + 7}" ht="30" customHeight="1">${row.map((v, col) => `<c r="${String.fromCharCode(65 + col)}${i + 7}" s="${DATA_CELL_STYLE}" t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`).join('')}</row>`).join('')
  files['xl/worksheets/sheet1.xml'] = strToU8(sheet.replace('<dimension ref="A1:K6"/>', `<dimension ref="A1:K${rows.length + 6}"/>`).replace('</sheetData>', `${data}</sheetData>`))
  const output = zipSync(files)
  if (output.byteLength > MAX_IMPORT_BYTES) throw new Error('匯入檔超過賣貨便2 MB限制，請減少本批訂單數量後再試')
  return output
}

export async function buildWorkbook(rows: ImportRow[]) {
  const template = await readFile(join(process.cwd(), TEMPLATE_FILE))
  return fillOfficialTemplate(template, rows)
}
