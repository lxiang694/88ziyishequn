import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goodsLength, goodsText, stripNote, validateRow } from '../lib/myship/domain.ts'

const item = (sku: string, name: string, variant: string, quantity = 1) =>
  ({ sku_snapshot: sku, product_name_snapshot: name, variant_name_snapshot: variant, quantity })

// 截圖那張 10 樣商品的訂單
const order = [
  item('A78', 'B群B50錠', '1瓶/90顆'), item('A12', '脂質體維生素 C', '1瓶（180顆）'), item('A1', 'NAC', '1瓶（100顆）'),
  item('A27', '納豆雙激酶', '1瓶'), item('A43', '6合一綜合維生素', '一瓶（90顆）'), item('A54', 'NAD', '1瓶'),
  item('A41', 'AKG補充劑', '1瓶/90顆'), item('A21', '布拉迪益生菌(需發冷鏈 請洽詢LINE購買)', '1盒'),
  item('A19', '綜合蔬果酵素', '1瓶'), item('A20', '控糖益生菌', '3袋', 1),
]

test('字數跟匯出驗證用同一種算法', () => {
  const row = (goods: string) => ['王小明', '0912345678', '123456', '常溫', goods, '1000', '0', '2026/11/11', '', 'x']
  const ok = 'A'.repeat(200), bad = 'A'.repeat(201)
  assert.equal(validateRow(row(ok)).some(e => e.includes('商品明細')), false)
  assert.equal(validateRow(row(bad)).some(e => e.includes('商品明細')), true)
  assert.equal(goodsLength(order), Array.from(goodsText(order)).length)
})

test('去掉括號說明後就在 200 字內', () => {
  const fixed = order.map(i => ({ ...i, product_name_snapshot: stripNote(i.product_name_snapshot) }))
  assert.ok(goodsLength(fixed) <= 200, `還有 ${goodsLength(fixed)} 字`)
  assert.equal(stripNote('布拉迪益生菌(需發冷鏈 請洽詢LINE購買)'), '布拉迪益生菌')
  assert.equal(stripNote('魚油（大罐）'), '魚油')
  assert.equal(stripNote('（限定）'), '（限定）')     // 整個都是括號就不動
  assert.equal(stripNote('NAC'), 'NAC')
})

test('一鍵精簡：去掉括號裡的說明，保留有數字的括號', async () => {
  const { trimNotes } = await import('../lib/myship/domain.ts')
  assert.equal(trimNotes('30-40磅（推荐女生用）【2个】'), '30-40磅【2个】')
  assert.equal(trimNotes('布拉迪益生菌(需發冷鏈 請洽詢LINE購買)'), '布拉迪益生菌')
  assert.equal(trimNotes('一盒（4支）'), '一盒（4支）')
  assert.equal(trimNotes('6L容量（3-4人用）'), '6L容量（3-4人用）')
  assert.equal(trimNotes('成人款+30包醫用洗鼻鹽(500ml)'), '成人款+30包醫用洗鼻鹽(500ml)')
  assert.equal(trimNotes('（限定款）'), '（限定款）')
})

test('一鍵精簡一樣商品：規格開頭重複的品名拿掉', async () => {
  const { simplifyItem } = await import('../lib/myship/domain.ts')
  assert.deepEqual(simplifyItem('青蒿牙膏', '青蒿牙膏1盒'), { name: '青蒿牙膏', variant: '1盒' })
  assert.deepEqual(simplifyItem('飄逸杯', '飄逸杯（520ml）'), { name: '飄逸杯', variant: '（520ml）' })
  assert.deepEqual(simplifyItem('矽膠握力器', '30-40磅（推荐女生用）【2个】'), { name: '矽膠握力器', variant: '30-40磅【2个】' })
  assert.deepEqual(simplifyItem('牙膏', '牙膏'), { name: '牙膏', variant: '牙膏' })   // 拿掉會變空白就不拿
})
