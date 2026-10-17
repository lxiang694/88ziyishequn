import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSafePhone, sanitizeProfilePatch, priceOrderItems, PUBLIC_ORDER_COLUMNS } from '../lib/orderSecurity.ts'

test('手機格式：只有 09 開頭 10 碼能放進查詢條件', () => {
  assert.ok(isSafePhone('0912345678'))
  for (const bad of ['', null, undefined, '091234567', '09123456789', '0912345678),user_id.not.is.null', '0912345678,phone.neq.x', 912345678]) {
    assert.equal(isSafePhone(bad), false, String(bad))
  }
})

test('個人資料：特製的手機字串會被擋下，不會存進資料庫', () => {
  assert.match(sanitizeProfilePatch({ phone: '0912345678),user_id.not.is.null' }).error!, /手機/)
  assert.deepEqual(sanitizeProfilePatch({ phone: '0912-345-678', name: ' 王小明 ' }).value, { phone: '0912345678', name: '王小明' })
  assert.deepEqual(sanitizeProfilePatch({ phone: '' }).value, { phone: null })
  assert.deepEqual(sanitizeProfilePatch({ is_admin: true, user_id: 'x' }).value, {}, '不在白名單的欄位一律忽略')
  assert.match(sanitizeProfilePatch({ name: 'x'.repeat(41) }).error!, /太長/)
  assert.match(sanitizeProfilePatch({ default_store_id: 'abc' }).error!, /門市/)
})

const variants = [
  { id: 11, product_id: 1, variant_name: '一盒', sale_price: 650, sku_code: 'A1', is_active: true, products: { product_name: '艾絨披肩', cover_image_url: null, is_published: true } },
  { id: 12, product_id: 1, variant_name: '停售款', sale_price: 500, sku_code: null, is_active: false, products: { product_name: '艾絨披肩', cover_image_url: null, is_published: true } },
  { id: 21, product_id: 2, variant_name: '下架', sale_price: 300, sku_code: null, is_active: true, products: { product_name: '舊商品', cover_image_url: null, is_published: false } },
]

test('下單：價格與名稱一律用資料庫的，瀏覽器送來的 1 元無效', () => {
  const { value } = priceOrderItems([{ product_id: 1, variant_id: 11, quantity: 2, unit_price: 1, product_name: '假名' } as any], variants)
  assert.deepEqual(value, [{ product_id: 1, product_name: '艾絨披肩', cover_image_url: null, variant_id: 11, variant_name: '一盒', sku_code: 'A1', unit_price: 650, quantity: 2 }])
})

test('下單：停售、下架、規格不屬於該商品、數量異常都擋下', () => {
  assert.match(priceOrderItems([{ product_id: 1, variant_id: 12, quantity: 1 }], variants).error!, /下架|變更/)
  assert.match(priceOrderItems([{ product_id: 2, variant_id: 21, quantity: 1 }], variants).error!, /下架|變更/)
  assert.match(priceOrderItems([{ product_id: 2, variant_id: 11, quantity: 1 }], variants).error!, /下架|變更/)
  assert.match(priceOrderItems([{ product_id: 1, variant_id: 99, quantity: 1 }], variants).error!, /下架|變更/)
  for (const q of [0, -1, 1.5, 100, 'x']) assert.match(priceOrderItems([{ product_id: 1, variant_id: 11, quantity: q }], variants).error!, /格式/)
  assert.match(priceOrderItems([{ product_id: 1, variant_id: 11, quantity: 1 }, { product_id: 1, variant_id: 11, quantity: 1 }], variants).error!, /格式/)
  assert.match(priceOrderItems([], variants).error!, /空/)
})

test('公開查訂單的欄位不含個資', () => {
  for (const col of ['customer_name', 'phone', 'line_id', 'note', 'user_id', '*']) {
    assert.ok(!new RegExp(`(^|[\\s,(])${col.replace('*', '\\*')}([\\s,)]|$)`).test(PUBLIC_ORDER_COLUMNS), col)
  }
})
