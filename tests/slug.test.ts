import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSlug, generateSlug } from '../lib/utils.ts'

describe('自訂網址識別碼', () => {
  test('正常輸入原樣保留', () => {
    assert.equal(normalizeSlug('wild-camellia-oil'), 'wild-camellia-oil')
  })

  test('轉小寫、空白與底線變連字號', () => {
    assert.equal(normalizeSlug('Wild Camellia_Oil'), 'wild-camellia-oil')
  })

  test('中文被移除（會被瀏覽器編碼成一長串亂碼）', () => {
    assert.equal(normalizeSlug('野生茶籽油'), '')
    // 中文移除後頭尾留下的連字號也會被去掉
    assert.equal(normalizeSlug('野生-camellia-油'), 'camellia')
  })

  test('中文混英文只留英文部分，且頭尾不留連字號', () => {
    assert.equal(normalizeSlug('野生camellia油'), 'camellia')
  })

  test('去掉危險字元', () => {
    assert.equal(normalizeSlug('a/b?c=1&d#e'), 'abc1de')
    assert.equal(normalizeSlug('../../etc/passwd'), 'etcpasswd')
  })

  test('連續連字號收斂成一個，頭尾去除', () => {
    assert.equal(normalizeSlug('--a---b--'), 'a-b')
  })

  test('空值一律回空字串（呼叫端會退回自動產生）', () => {
    assert.equal(normalizeSlug(''), '')
    assert.equal(normalizeSlug('   '), '')
    assert.equal(normalizeSlug(null), '')
    assert.equal(normalizeSlug(undefined), '')
    assert.equal(normalizeSlug('！！！'), '')
  })

  test('限長 60 字', () => {
    assert.equal(normalizeSlug('a'.repeat(100)).length, 60)
  })

  test('結果只含允許的字元', () => {
    for (const input of ['Wild Camellia Oil 500ml', '野生/茶籽油?v=2', 'A_B C--D']) {
      assert.match(normalizeSlug(input) || 'x', /^[a-z0-9-]+$/)
    }
  })
})

describe('自動產生的識別碼（沒填時的退路）', () => {
  test('帶時間戳，所以不會重複', () => {
    const a = generateSlug('野生茶籽油')
    assert.match(a, /^野生茶籽油-\d+$/)
  })
})
