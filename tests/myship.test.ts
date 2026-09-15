import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
import { prepareOrder, validateRow, parseIds, snapshot, type TransferOrder } from '../lib/myship/domain'
import { fillOfficialTemplate } from '../lib/myship/workbook'

const market = { id: 'GM2601252733206', name: '小莊備用88', temperature: '常溫', enabled: true }
const mapping = [{ variant_id: 20, marketplace_id: market.id }]
const store = { id: 1, store_code: '001234', store_name: '測試', address: '臺中市測試路1號', is_active: true }
const order: TransferOrder = { id: 1, order_no: 'TWTEST', customer_name: '測試客', phone: '0900000000', store_id: 1, store_name: '測試', store_address: '台中市測試路1號', order_status: '待確認', total_amount: 1100, created_at: '2026-09-08T17:00:00Z', updated_at: '2026-09-08T17:00:00Z', note: '', order_items: [{ id: 1, variant_id: 20, product_name_snapshot: '測試商品', variant_name_snapshot: '3袋', sku_snapshot: 'A20', unit_price: 1100, quantity: 1, subtotal: 1100 }] }
const prepare = (o = order) => prepareOrder(o, mapping, [market], store)

test('三袋規格一組、手機前導零、門市代碼及臺灣下單日期完整保留', () => {
  const p = prepare(); assert.deepEqual(p.errors, [])
  assert.deepEqual(p.row, ['測試客','0900000000','001234','常溫','A20 測試商品（3袋）×1','1100','0','2026/09/09','','健康優選訂單：TWTEST'])
})
test('沒有配對、空白店號、不同地址、停用賣場不匯出', () => {
  for (const p of [prepareOrder(order, [], [market], store), prepareOrder(order, mapping, [market], { ...store, store_code: null }), prepareOrder(order, mapping, [market], { ...store, address: '別處' }), prepareOrder(order, mapping, [{ ...market, enabled: false }], store)]) assert.equal(p.row, null)
})
test('跨賣場不可自動拆單重複代收', () => {
  const o = { ...order, total_amount: 2200, order_items: [...order.order_items, { ...order.order_items[0], id: 2, variant_id: 21 }] }
  const p = prepareOrder(o, [...mapping, { variant_id: 21, marketplace_id: 'GM2' }], [market], store)
  assert.equal(p.row, null); assert.ok(p.errors.some(e => e.includes('不同賣場')))
})
test('金額不平、非整數數量及非待確認狀態拒絕匯出', () => {
  for (const o of [{ ...order, total_amount: 1000 }, { ...order, order_status: '已取消' }, { ...order, order_items: [{ ...order.order_items[0], quantity: 1.5 }] }]) assert.equal(prepare(o).row, null)
})
test('範本代收金額上下限、姓名與字數限制', () => {
  const row = prepare().row!
  for (const amount of ['0','54','20001','NaN','1.5','1e3']) assert.ok(validateRow(row.map((v, i) => i === 5 ? amount : v)).length)
  for (const amount of ['55','20000']) assert.deepEqual(validateRow(row.map((v, i) => i === 5 ? amount : v)), [])
  for (const name of ['六個中文姓名','A1','A-B','王😀']) assert.ok(validateRow(row.map((v, i) => i === 0 ? name : v)).length)
  assert.ok(validateRow(row.map((v, i) => i === 8 ? '字'.repeat(201) : v)).length)
})
test('備註不截斷、非法XML字元不可進入工作簿', () => {
  assert.equal(prepare({ ...order, note: '字'.repeat(201) }).row, null)
  assert.equal(prepare({ ...order, note: '\u0001' }).row, null)
})
test('批次選取邊界及重複ID', () => {
  for (const ids of [[], [1, 1], ['1'], [-1], [1.5], Array.from({ length: 501 }, (_, i) => i + 1)]) assert.throws(() => parseIds(ids))
  assert.deepEqual(parseIds([2, 1]), [1, 2])
  assert.equal(parseIds(Array.from({ length: 500 }, (_, i) => i + 1)).length, 500)
})
test('快照商品排序穩定', () => {
  const o = { ...order, order_items: [{ ...order.order_items[0], id: 2 }, order.order_items[0]] }
  assert.equal(snapshot(o).items[0].id, 1)
  assert.equal(o.order_items[0].id, 2)
})
test('官方XLSM原始部件完整保留，資料全為文字且不產生公式', async () => {
  const input = await readFile(new URL('../assets/myship/order-import-v1.4.xlsm', import.meta.url))
  const row = prepare({ ...order, note: '=HYPERLINK("https://example.test","<test>&")' }).row!
  const output = fillOfficialTemplate(input, [row])
  const before = unzipSync(input); const after = unzipSync(output)
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort())
  for (const name of Object.keys(before)) if (name !== 'xl/worksheets/sheet1.xml') assert.deepEqual(after[name], before[name], name)
  const xml = strFromU8(after['xl/worksheets/sheet1.xml'])
  assert.match(xml, /ref="A1:K7"/); assert.match(xml, />001234</); assert.match(xml, />0900000000</)
  assert.match(xml, /&lt;test&gt;&amp;/); assert.equal(xml.includes('<f>'), false)
  assert.equal((xml.match(/t="inlineStr"/g) || []).length, 10)
  assert.throws(() => fillOfficialTemplate(input, []))
  assert.throws(() => fillOfficialTemplate(input, Array(501).fill(row)))
  assert.throws(() => fillOfficialTemplate(new Uint8Array([0]), [row]))
  assert.match(strFromU8(unzipSync(fillOfficialTemplate(input, Array(500).fill(row)))['xl/worksheets/sheet1.xml']), /ref="A1:K506"/)
})
