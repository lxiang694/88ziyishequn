import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeSearchTerm, validateStore } from '../lib/stores.ts'

const base = { store_code: '295499', store_name: '正隆', county: '新北市', district: '板橋區', address: '新北市板橋區正隆路1號' }

test('門市資料檢查與整理', () => {
  assert.deepEqual(validateStore(base), { ok: true, value: { ...base, is_active: true } })
  assert.equal((validateStore({ ...base, store_name: '7-11 正隆門市' }) as any).value.store_name, '正隆')
  assert.equal((validateStore({ ...base, store_code: ' 295 499 ' }) as any).value.store_code, '295499')
  assert.equal((validateStore({ ...base, is_active: false }) as any).value.is_active, false)
  assert.match((validateStore({ ...base, store_code: '27624' }) as any).error, /6 位數字/)
  assert.match((validateStore({ ...base, county: '新北' }) as any).error, /縣市/)
  assert.match((validateStore({ ...base, district: '板橋' }) as any).error, /鄉鎮區/)
  assert.match((validateStore({ ...base, address: '板橋' }) as any).error, /地址/)
})

test('搜尋字串清掉查詢語法字元', () => {
  assert.equal(safeSearchTerm('正隆'), '正隆')
  assert.equal(safeSearchTerm('a,is_active.eq.false),(x'), 'ais_active.eq.falsex')
  assert.equal(safeSearchTerm(null), '')
})
