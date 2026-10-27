import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCustomers, callName, contactOutcome, filterList, normalizePhone, statusOf, summarizeCustomers, winBackMessage, type CustomerOrder } from '../lib/crm.ts'

const NOW = new Date('2026-10-27T04:00:00Z').getTime()
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString()
const o = (phone: string, days: number, amount: number, extra: Partial<CustomerOrder> = {}): CustomerOrder =>
  ({ phone, customer_name: '王小明', total_amount: amount, created_at: ago(days), source: 'shop', items: ['醣溜溜'], ...extra })

test('手機統一格式', () => {
  assert.equal(normalizePhone('0912-345-678'), '0912345678')
  assert.equal(normalizePhone('+886912345678'), '0912345678')
  assert.equal(normalizePhone('02-2345678'), null)
  assert.equal(normalizePhone(null), null)
})

test('狀態分界', () => {
  assert.equal(statusOf(30), 'active')
  assert.equal(statusOf(31), 'steady')
  assert.equal(statusOf(60), 'steady')
  assert.equal(statusOf(61), 'dormant')
  assert.equal(statusOf(180), 'dormant')
  assert.equal(statusOf(181), 'lost')
})

test('一般訂單與團購訂單依手機合併成同一位客人', () => {
  const { customers } = buildCustomers([
    o('0912345678', 100, 900),
    o('0912-345-678', 40, 1430, { source: 'group_buy', items: ['邱家鱸魚精'], customer_name: '王小明' }),
    o('0987654321', 10, 600, { customer_name: '陳美玲', line_id: 'mei' }),
  ], NOW)
  const wang = customers.find(c => c.phone === '0912345678')!
  assert.equal(wang.orders, 2)
  assert.equal(wang.group_buy_orders, 1)
  assert.equal(wang.spend, 2330)
  assert.equal(wang.days_since, 40)
  assert.equal(wang.cycle_days, 60)
  assert.deepEqual(wang.last_items, ['邱家鱸魚精'])
  assert.equal(wang.status, 'steady')
  assert.equal(customers.find(c => c.phone === '0987654321')!.line_id, 'mei')
})

test('該回購了：超過自己的回購週期，但還沒流失', () => {
  const { customers, globalCycle } = buildCustomers([
    o('0911111111', 100, 500), o('0911111111', 70, 500),   // 週期 30 天，已 70 天沒買 → 逾期 40 天
    o('0922222222', 50, 500), o('0922222222', 10, 500),    // 週期 40 天，10 天前買 → 還沒到
    o('0933333333', 400, 500),                              // 流失，不算該回購
  ], NOW)
  assert.equal(globalCycle, 35)
  assert.equal(customers.find(c => c.phone === '0911111111')!.due, true)
  assert.equal(customers.find(c => c.phone === '0922222222')!.due, false)
  assert.equal(customers.find(c => c.phone === '0933333333')!.due, false)
})

test('總覽：核心客戶貢獻、近 90 天老客營收占比', () => {
  const orders = [
    o('0911111111', 5, 8000), o('0911111111', 20, 2000),
    ...['0922222222', '0933333333', '0944444444', '0955555555'].map(p => o(p, 200, 500)),
  ]
  const { customers, globalCycle } = buildCustomers(orders, NOW)
  const s = summarizeCustomers(customers, globalCycle)
  assert.equal(s.customers, 5)
  assert.equal(s.core_count, 1)
  assert.equal(s.core_share, 83.3)
  assert.equal(s.status.lost.count, 4)
  assert.equal(s.returning_share_90d, 100)
  assert.equal(s.one_time_dormant, 4)
  assert.deepEqual(filterList(customers, 'core').map(c => c.phone), ['0911111111'])
})

test('稱呼與 LINE 訊息', () => {
  assert.equal(callName('王小明'), '小明')
  assert.equal(callName('王明'), '王明')
  assert.equal(callName('Jessica Lin'), 'Jessica')
  const { customers } = buildCustomers([o('0911111111', 100, 500), o('0911111111', 70, 500)], NOW)
  const msg = winBackMessage(customers[0], 'due', 'https://www.88ziyishequn.com')
  assert.match(msg, /^小明您好/)
  assert.match(msg, /醣溜溜/)
  assert.match(msg, /utm_source=line&utm_medium=winback&utm_campaign=due/)
})

test('聯繫成效', () => {
  assert.equal(contactOutcome(ago(1), ago(5), NOW), 'won')
  assert.equal(contactOutcome(ago(40), ago(5), NOW), 'waiting')
  assert.equal(contactOutcome(ago(90), ago(45), NOW), 'no_response')
})
