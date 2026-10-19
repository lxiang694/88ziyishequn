import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareGroupBuyRow, groupBuyOrderErrors, temperatureOf, type GroupBuyTransferOrder } from '../lib/myship/groupBuy.ts'
import { matchResultRows } from '../lib/myship/results.ts'

const store = { id: 7, store_code: '293116', store_name: '湖慧', address: '高雄市湖內區中山路一段540-1號', is_active: true }
const frozenMarket = { id: 'GM1000001', name: '冷凍賣場', temperature: '冷凍', enabled: true }
const normalMarket = { id: 'GM2601252733206', name: '小莊備用88', temperature: '常溫', enabled: true }
const order = (o: Partial<GroupBuyTransferOrder> = {}): GroupBuyTransferOrder => ({
  id: 1, order_no: 'GB20261020000001', campaign_id: 1, customer_name: ' 王小明 ', phone: '0912345678',
  shipping_method: '711', store_id: 7, store_name: '湖慧', store_address: '高雄市湖內區中山路一段540-1號',
  note: '', subtotal: 2560, shipping_fee: 150, total_amount: 2710, status: '待出貨', created_at: '2026-10-19T16:30:00Z',
  group_buy_order_items: [{ id: 11, name_snapshot: '金目鱸魚精', spec_snapshot: '6入', unit_price: 1280, quantity: 2, subtotal: 2560 }],
  ...o,
})

test('溫層對應：冷凍→冷凍賣場、常溫→常溫賣場、宅配不走賣貨便', () => {
  assert.equal(temperatureOf('711'), '冷凍')
  assert.equal(temperatureOf('711_normal'), '常溫')
  assert.equal(temperatureOf('home'), null)
})

test('匯入列：代收應收總額（含運費）、運費欄 0、商品寫上運費、團購標記', () => {
  const { row, errors } = prepareGroupBuyRow(order(), frozenMarket, store)
  assert.deepEqual(errors, [])
  assert.deepEqual(row, ['王小明', '0912345678', '293116', '冷凍', '金目鱸魚精（6入）×2；運費150元', '2710', '0', '2026/10/20', '', '健康優選團購：GB20261020000001'])
})

test('擋下：選錯溫層的賣場、宅配、門市關閉或改名、金額對不上', () => {
  assert.match(prepareGroupBuyRow(order(), normalMarket, store).errors.join(), /冷凍訂單，請選冷凍賣場/)
  assert.match(groupBuyOrderErrors(order({ shipping_method: 'home' }), store).join(), /黑貓宅配/)
  assert.match(groupBuyOrderErrors(order(), { ...store, is_active: false }).join(), /門市不存在或已停用/)
  assert.match(groupBuyOrderErrors(order(), { ...store, store_name: '新湖慧' }).join(), /名稱或地址與訂單不一致/)
  assert.match(groupBuyOrderErrors(order({ total_amount: 2000 }), store).join(), /金額/)
  assert.equal(prepareGroupBuyRow(order(), normalMarket, store).row, null)
})

test('結果檔核對認得團購標記', () => {
  const { row } = prepareGroupBuyRow(order(), frozenMarket, store)
  const transfers = [{ id: 't1', order_id: null, group_buy_order_id: 1, import_row: row!, status: 'exported', external_order_no: null }]
  const r = matchResultRows([{ row: row!, external_order_no: 'CM2610200000001', sheet_row: 2 }], transfers)
  assert.deepEqual(r.confirmed, [{ transfer_id: 't1', order_no: 'GB20261020000001', external_order_no: 'CM2610200000001' }])
})
