import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { parseResultWorkbook, matchResultRows, RESULT_HEADERS, type ResultTransfer } from '../lib/myship/results'
import type { ImportRow } from '../lib/myship/domain'

const row: ImportRow = ['測試客', '0900000000', '001234', '常溫', 'A20 測試商品（3袋）×1', '1100', '0', '2026/09/09', '', '健康優選訂單：TW20260909000001']
const transfer = (values = row, id = 'one'): ResultTransfer => ({ id, order_id: 1, import_row: values, status: 'exported', external_order_no: null })
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function workbook(rows: string[][], shared = true, edit = (s: string) => s) {
  const values = [RESULT_HEADERS, ...rows], strings: string[] = []
  const xmlRows = values.map((r, n) => `<row r="${n + 1}">${r.map((v, c) => {
    const i = strings.push(v) - 1
    return `<c r="${String.fromCharCode(65 + c)}${n + 1}" t="${shared ? 's' : 'inlineStr'}">${shared ? `<v>${i}</v>` : `<is><t>${escape(v)}</t></is>`}</c>`
  }).join('')}</row>`).join('')
  return zipSync({
    'xl/worksheets/sheet1.xml': strToU8(edit(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`)),
    'xl/sharedStrings.xml': strToU8(`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map(s => `<si><t>${escape(s)}</t></si>`).join('')}</sst>`),
  })
}

test('讀取實際11欄格式：保留前導零、原單號、CM號與特殊文字', () => {
  const values = [...row] as ImportRow; values[8] = 'A&B <備註>'
  for (const shared of [true, false]) {
    const parsed = parseResultWorkbook(workbook([[...values, 'CM2609090000001']], shared))
    assert.deepEqual(parsed[0].row, values)
    const result = matchResultRows(parsed, [transfer(values)])
    assert.equal(result.confirmed[0].external_order_no, 'CM2609090000001')
    assert.equal(result.unresolved.length, 0)
  }
})
test('按原單號比對，結果重新排序仍可核對；缺列保持待處理', () => {
  const second = [...row] as ImportRow; second[9] = '健康優選訂單：TW20260909000002'
  const parsed = parseResultWorkbook(workbook([[...second, 'CM2609090000002'], [...row, 'CM2609090000001']]))
  assert.deepEqual(matchResultRows(parsed, [transfer(), transfer(second, 'two')]).confirmed.map(r => r.transfer_id), ['two', 'one'])
  const partial = matchResultRows(parsed.slice(0, 1), [transfer(), transfer(second, 'two')])
  assert.equal(partial.confirmed.length, 1); assert.equal(partial.unresolved.length, 1)
})
test('錯誤金額、商品、門市、手機、姓名、未知或重複原單號均不准回寫', () => {
  for (const index of [0, 1, 2, 4, 5, 6, 8, 9]) {
    const changed = [...row]; changed[index] += '1'
    assert.throws(() => matchResultRows(parseResultWorkbook(workbook([[...changed, 'CM2609090000001']])), [transfer()]))
  }
  const parsed = parseResultWorkbook(workbook([[...row, 'CM2609090000001'], [...row, 'CM2609090000002']]))
  assert.throws(() => matchResultRows(parsed, [transfer()]))
})
test('失敗文字、空編號、收款單號不冒充成功；CM不能跨單重複', () => {
  for (const external of ['', '匯入失敗', 'CC2609090000001', '成功CM2609090000001', 'CM2609090000001x']) {
    const result = matchResultRows(parseResultWorkbook(workbook([[...row, external]])), [transfer()])
    assert.equal(result.confirmed.length, 0); assert.equal(result.unresolved.length, 1)
  }
  const second = [...row] as ImportRow; second[9] = '健康優選訂單：TW20260909000002'
  assert.throws(() => matchResultRows(parseResultWorkbook(workbook([[...row, 'CM2609090000001'], [...second, 'CM2609090000001']])), [transfer(), transfer(second, 'two')]))
})
test('已確認可重讀相同結果，已解除、刪除或不同CM號拒絕', () => {
  const parsed = parseResultWorkbook(workbook([[...row, 'CM2609090000001']]))
  assert.equal(matchResultRows(parsed, [{ ...transfer(), status: 'confirmed', external_order_no: 'CM2609090000001' }]).confirmed.length, 1)
  for (const t of [{ ...transfer(), status: 'released' }, { ...transfer(), order_id: null }, { ...transfer(), status: 'confirmed', external_order_no: 'CM2609090000002' }]) assert.throws(() => matchResultRows(parsed, [t]))
})
test('拒絕公式、未知欄位、XML實體、重複儲存格及過大壓縮內容', () => {
  for (const edit of [
    (s: string) => s.replace('<v>11</v>', '<f>1+1</f><v>11</v>'),
    (s: string) => s.replace('r="K1"', 'r="L1"'),
    (s: string) => '<!DOCTYPE worksheet [<!ENTITY secret "secret">]>' + s,
    (s: string) => s.replace('r="B2"', 'r="A2"'),
  ]) assert.throws(() => parseResultWorkbook(workbook([[...row, 'CM2609090000001']], true, edit)))
  assert.throws(() => parseResultWorkbook(zipSync({ 'xl/worksheets/sheet1.xml': strToU8('x'.repeat(4_000_001)) })))
  assert.throws(() => parseResultWorkbook(new Uint8Array(2_000_001)))
  assert.throws(() => parseResultWorkbook(workbook(Array(501).fill([...row, 'CM2609090000001']))))
})
