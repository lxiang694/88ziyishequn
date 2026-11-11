import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankRecommendations, countCoBought } from '../lib/productRecommend.ts'

const v = (stock = 10, price = 300, active = true) => ({ id: Math.random(), sale_price: price, stock_qty: stock, is_active: active })
const p = (id: number, variants = [v()]) => ({ id, product_variants: variants })
const none = { coBought: new Map<number, number>(), sameShop: new Set<number>(), sameHealth: new Set<number>(), sales: {} as Record<number, number> }

test('常一起買 > 同分類 > 同健康訴求 > 熱銷', () => {
  const r = rankRecommendations(1, [p(2), p(3), p(4), p(5), p(1)], {
    coBought: new Map([[5, 3]]), sameShop: new Set([3]), sameHealth: new Set([4]), sales: { 2: 999 },
  })
  assert.deepEqual(r.map(x => x.product.id), [5, 3, 4, 2])
  assert.deepEqual(r.map(x => x.reason), ['together', 'similar', 'similar', 'popular'])
})

test('排除自己、售完、停用、沒有價格的商品；最多 6 件', () => {
  const r = rankRecommendations(1, [p(1), p(2, [v(0)]), p(3, [v(10, 300, false)]), p(4, [v(10, 0)]),
    ...[5, 6, 7, 8, 9, 10, 11].map(id => p(id))], none)
  assert.deepEqual(r.map(x => x.product.id), [5, 6, 7, 8, 9, 10])
})

test('只一起買過一次不標「常一起買」，但仍排前面', () => {
  const r = rankRecommendations(1, [p(2), p(3)], { ...none, coBought: new Map([[3, 1]]) })
  assert.equal(r[0].product.id, 3)
  assert.equal(r[0].reason, 'popular')
})

test('一起買次數：同一張訂單重複列只算一次，不算自己', () => {
  const m = countCoBought(1, [
    { order_id: 10, product_id: 1 }, { order_id: 10, product_id: 2 }, { order_id: 10, product_id: 2 },
    { order_id: 11, product_id: 2 }, { order_id: 11, product_id: 3 }, { order_id: 12, product_id: null },
  ])
  assert.deepEqual([...m.entries()], [[2, 2], [3, 1]])
})
