import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortShopProducts, strikePrice } from '../lib/shopSort.ts'

const v = (sale_price: number, stock_qty = 10, original_price: number | null = null) => ({ is_active: true, sale_price, stock_qty, original_price })
const p = (id: number, price: number, sales: number, day: number, stock = 10) =>
  ({ id, sales_count: sales, created_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`, product_variants: [v(price, stock)] })
// 1 號賣最好但售完
const list = [p(1, 500, 300, 1, 0), p(2, 300, 100, 5), p(3, 900, 50, 9), p(4, 120, 10, 3)]
const ids = (sort: any) => sortShopProducts(list, sort).map(x => x.id)

test('四種排序，售完的一律排最後', () => {
  assert.deepEqual(ids('hot'), [2, 3, 4, 1])
  assert.deepEqual(ids('new'), [3, 2, 4, 1])
  assert.deepEqual(ids('price_asc'), [4, 2, 3, 1])
  assert.deepEqual(ids('price_desc'), [3, 2, 4, 1])
})

test('劃線原價：只用最便宜那個規格的原價，比售價高才顯示', () => {
  assert.equal(strikePrice({ product_variants: [v(360, 10, 450), v(980, 10, 1350)] }), 450)
  assert.equal(strikePrice({ product_variants: [v(360), v(980, 10, 1350)] }), null)   // 不拿三瓶組的原價湊
  assert.equal(strikePrice({ product_variants: [v(360, 10, 360)] }), null)
  assert.equal(strikePrice({ product_variants: [v(360, 0, 450), v(500, 10, 600)] }), 600) // 售完的規格不算
})
