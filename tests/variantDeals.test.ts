import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCount, variantDeals } from '../lib/variantDeals.ts'

test('從規格名稱讀數量與單位', () => {
  assert.deepEqual(parseCount('1瓶（100顆）'), { count: 1, unit: '瓶' })
  assert.deepEqual(parseCount('三瓶組'), { count: 3, unit: '瓶' })
  assert.deepEqual(parseCount('一盒（4支）'), { count: 1, unit: '盒' })
  assert.equal(parseCount('紅色'), null)
})

test('NAC：1瓶 580、2瓶 1098 → 每瓶 549、省 62', () => {
  const d = variantDeals([{ id: 1, variant_name: '1瓶（100顆）', sale_price: 580 }, { id: 2, variant_name: '2瓶', sale_price: 1098 }])
  assert.deepEqual(d.get(1), { perUnit: 580, unit: '瓶', save: 0 })
  assert.deepEqual(d.get(2), { perUnit: 549, unit: '瓶', save: 62 })
})

test('單位不同、讀不出來、數量都一樣 → 不算（寧可不寫）', () => {
  assert.equal(variantDeals([{ id: 1, variant_name: '1瓶', sale_price: 500 }, { id: 2, variant_name: '1盒', sale_price: 900 }]).size, 0)
  assert.equal(variantDeals([{ id: 1, variant_name: '紅色', sale_price: 550 }, { id: 2, variant_name: '紫色', sale_price: 820 }]).size, 0)
  assert.equal(variantDeals([{ id: 1, variant_name: '1瓶 原味', sale_price: 500 }, { id: 2, variant_name: '1瓶 檸檬', sale_price: 520 }]).size, 0)
  // 組合比較貴就不寫省多少
  assert.equal(variantDeals([{ id: 1, variant_name: '1瓶', sale_price: 500 }, { id: 2, variant_name: '2瓶', sale_price: 1100 }]).get(2)!.save, 0)
})
