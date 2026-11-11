import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickTrending } from '../lib/homeTrending.ts'

const p = (id: number, stock = 10, img: string | null = 'x') => ({ id, cover_image_url: img, product_variants: [{ is_active: true, stock_qty: stock }] })
// 累計銷量：1 > 2 > 3 > 4 > 5
const products = [p(1), p(2), p(3), p(4), p(5)]

test('照最近 7 天的訂單數排，不照累計銷量', () => {
  const rows = [{ order_id: 1, product_id: 5 }, { order_id: 2, product_id: 5 }, { order_id: 3, product_id: 4 }, { order_id: 4, product_id: 4 }, { order_id: 5, product_id: 4 }, { order_id: 6, product_id: 3 }]
  assert.deepEqual(pickTrending(products, rows), { ids: [4, 5, 3], label: '最近大家都在買' })
})

test('同一張訂單重複列只算一次：一張大訂單不能洗版', () => {
  const rows = [{ order_id: 1, product_id: 5 }, { order_id: 1, product_id: 5 }, { order_id: 1, product_id: 5 }, { order_id: 2, product_id: 3 }, { order_id: 3, product_id: 3 }]
  assert.deepEqual(pickTrending(products, rows).ids.slice(0, 2), [3, 5])
})

test('最近 7 天不足三件：用累計熱銷補位，標題不寫「最近」', () => {
  assert.deepEqual(pickTrending(products, [{ order_id: 1, product_id: 4 }]), { ids: [4, 1, 2], label: '大家都在買' })
  assert.deepEqual(pickTrending(products, []), { ids: [1, 2, 3], label: '大家都在買' })
})

test('售完、沒有封面圖的不上第一屏', () => {
  const list = [p(1, 0), p(2, 10, null), p(3), p(4)]
  const r = pickTrending(list, [{ order_id: 1, product_id: 1 }, { order_id: 2, product_id: 2 }])
  assert.deepEqual(r.ids, [3, 4])
})
