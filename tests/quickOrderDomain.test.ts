import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORDER_SOURCES, isValidSource, parseResolvedItems, QuickOrderInputError } from '../lib/quickOrder/domain.ts'

test('來源白名單', () => {
  assert.ok(isValidSource('line_dm'))
  assert.equal(isValidSource('LINE'), false)
  assert.equal(isValidSource(''), false)
  assert.ok(ORDER_SOURCES.length > 0)
})

test('品項驗證：正常', () => {
  assert.deepEqual(
    parseResolvedItems([{ product_id: 1, variant_id: 11, quantity: 2 }]),
    [{ product_id: 1, variant_id: 11, quantity: 2 }])
})

test('品項驗證：擋掉重複規格（會扣兩次庫存）', () => {
  assert.throws(() => parseResolvedItems([
    { product_id: 1, variant_id: 11, quantity: 1 },
    { product_id: 1, variant_id: 11, quantity: 1 },
  ]), QuickOrderInputError)
})

test('品項驗證：擋掉沒選規格、數量異常、空陣列', () => {
  assert.throws(() => parseResolvedItems([]), QuickOrderInputError)
  assert.throws(() => parseResolvedItems([{ product_id: 1, quantity: 1 }]), QuickOrderInputError)
  assert.throws(() => parseResolvedItems([{ product_id: 1, variant_id: 11, quantity: 0 }]), QuickOrderInputError)
  assert.throws(() => parseResolvedItems([{ product_id: 1, variant_id: 11, quantity: 1000 }]), QuickOrderInputError)
})
