import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stockLevel, stockAlerts, needsRestock } from '../lib/adminStock.ts'

test('少於 5 件提醒、0 件是售完', () => {
  assert.equal(stockLevel(0), 'out')
  assert.equal(stockLevel(1), 'low')
  assert.equal(stockLevel(4), 'low')
  assert.equal(stockLevel(5), 'ok')
})

test('看每個啟用中的規格，不看加總；停用的規格不算', () => {
  const v = [
    { variant_name: '單盒', stock_qty: 28, is_active: true },
    { variant_name: '三盒組', stock_qty: 2, is_active: true },
    { variant_name: '舊包裝', stock_qty: 0, is_active: false },
  ]
  assert.deepEqual(stockAlerts(v), [{ name: '三盒組', qty: 2, level: 'low' }])
  assert.equal(needsRestock(v), true)
  assert.equal(needsRestock([{ stock_qty: 9, is_active: true }]), false)
  assert.deepEqual(stockAlerts([{ variant_name: 'A', stock_qty: 3, is_active: true }, { variant_name: 'B', stock_qty: 0, is_active: true }]).map(a => a.name), ['B', 'A'])
})
