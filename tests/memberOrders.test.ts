import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frequentVariants, isActiveOrder, isReadyForPickup, orderStage, reviewableProductIds, type MemberOrder } from '../lib/memberOrders.ts'

const item = (product_id: number, variant_id: number) => ({ name: '醣溜溜', variant: '1瓶', quantity: 1, subtotal: 930, image: null, product_id, variant_id })
const o = (status: string, extra: Partial<MemberOrder> = {}): MemberOrder => ({
  kind: 'shop', id: 1, order_no: 'TW1', status, created_at: new Date().toISOString(), total: 930,
  store_name: '長益', store_area: '台南市仁德區', phone: '0912345678', items: [item(1, 11)], ...extra,
})

test('一般訂單進度', () => {
  assert.equal(orderStage(o('待確認')).current, 0)
  assert.equal(orderStage(o('備貨中')).current, 1)
  assert.equal(orderStage(o('已出貨')).current, 2)
  const arrived = orderStage(o('已到店'))
  assert.equal(arrived.current, 3)
  assert.equal(arrived.done, true)
  assert.match(arrived.hint, /長益門市.*報取件人姓名或手機號碼/)
  assert.equal(orderStage(o('已取消')).cancelled, true)
})

test('團購訂單進度', () => {
  const g = (status: string) => orderStage(o(status, { kind: 'group_buy' }))
  assert.deepEqual(g('待出貨').steps, ['已跟團', '已出貨', '已完成'])
  assert.equal(g('待出貨').current, 0)
  assert.equal(g('已完成').done, true)
})

test('進行中／待取貨', () => {
  assert.equal(isActiveOrder(o('已出貨')), true)
  assert.equal(isActiveOrder(o('已到店')), false)
  assert.equal(isActiveOrder(o('已取消')), false)
  assert.equal(isReadyForPickup(o('已到店')), true)
  assert.equal(isReadyForPickup(o('已到店', { kind: 'group_buy' })), false)
})

test('常買商品與待評價', () => {
  const orders = [
    o('已到店', { created_at: '2026-10-20T00:00:00Z', items: [item(1, 11), item(2, 21)] }),
    o('已出貨', { created_at: '2026-09-01T00:00:00Z', items: [item(1, 11)] }),
    o('已取消', { items: [item(3, 31)] }),
    o('待確認', { items: [item(4, 41)] }),
  ]
  assert.deepEqual(frequentVariants(orders).map(f => [f.variant_id, f.times]), [[11, 2], [41, 1], [21, 1]])
  assert.deepEqual(reviewableProductIds(orders, new Set([2])), [1])
})

test('到店超過 8 天不再提醒取貨', () => {
  const now = new Date('2026-10-28T00:00:00Z').getTime()
  const recent = o('已到店', { updated_at: '2026-10-25T00:00:00Z' })
  const old = o('已到店', { updated_at: '2026-09-20T00:00:00Z' })
  assert.equal(isReadyForPickup(recent, now), true)
  assert.equal(isReadyForPickup(old, now), false)
  assert.match(orderStage(old, now).hint, /已送達門市/)
})
