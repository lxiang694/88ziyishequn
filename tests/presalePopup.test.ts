import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowPopup, popupSkipReason } from '../lib/presale/popupState.ts'

const base = {
  enabled: true,
  now: new Date('2026-09-01T10:00:00+08:00'),
  hideAfter: '2026-10-31',
  lastShownAt: null as number | null,
  cooldownHours: 12,
  pathname: '/',
  excludedPaths: ['/camellia-oil', '/cart', '/checkout', '/order-success'],
}

describe('彈窗顯示判斷', () => {
  test('一般情況會顯示', () => {
    assert.equal(shouldShowPopup(base), true)
    assert.equal(popupSkipReason(base), null)
  })

  test('總開關關掉就不顯示', () => {
    assert.equal(popupSkipReason({ ...base, enabled: false }), 'disabled')
  })
})

describe('活動結束後自動停止', () => {
  test('最後一天當天仍然會顯示（不會提早消失）', () => {
    const r = popupSkipReason({
      ...base, now: new Date('2026-10-31T23:00:00+08:00') })
    assert.equal(r, null)
  })

  test('過了最後一天就不再顯示', () => {
    assert.equal(popupSkipReason({
      ...base, now: new Date('2026-11-01T00:30:00+08:00') }), 'expired')
  })

  test('沒設定期限就不受限制', () => {
    assert.equal(popupSkipReason({
      ...base, hideAfter: '', now: new Date('2030-01-01T00:00:00+08:00') }), null)
  })

  test('期限格式壞掉時不會誤擋（寧可顯示也不要整個失效）', () => {
    assert.equal(popupSkipReason({ ...base, hideAfter: 'not-a-date' }), null)
  })
})

describe('關掉之後的冷卻時間', () => {
  const now = new Date('2026-09-01T10:00:00+08:00')

  test('剛看過就不再彈', () => {
    assert.equal(popupSkipReason({
      ...base, now, lastShownAt: now.getTime() - 60_000 }), 'cooldown')
  })

  test('冷卻期內都不彈', () => {
    assert.equal(popupSkipReason({
      ...base, now, lastShownAt: now.getTime() - 11 * 3600_000 }), 'cooldown')
  })

  test('超過冷卻期才會再彈', () => {
    assert.equal(popupSkipReason({
      ...base, now, lastShownAt: now.getTime() - 13 * 3600_000 }), null)
  })

  test('沒看過就會彈', () => {
    assert.equal(popupSkipReason({ ...base, lastShownAt: null }), null)
  })
})

describe('這些頁面不彈（彈了只會擋路）', () => {
  for (const p of ['/camellia-oil', '/cart', '/checkout', '/order-success']) {
    test(`${p} 不顯示`, () => {
      assert.equal(popupSkipReason({ ...base, pathname: p }), 'excluded_path')
    })
  }

  test('子路徑也不顯示', () => {
    assert.equal(popupSkipReason({
      ...base, pathname: '/checkout/confirm' }), 'excluded_path')
  })

  test('名稱只是開頭相同的其他路徑仍然會顯示', () => {
    // /cartoon 不是 /cart 的子路徑，不該被擋
    assert.equal(popupSkipReason({ ...base, pathname: '/cartoon' }), null)
  })

  test('商品頁與文章頁照常顯示', () => {
    assert.equal(popupSkipReason({ ...base, pathname: '/products/abc' }), null)
    assert.equal(popupSkipReason({ ...base, pathname: '/health-articles/xyz' }), null)
  })
})

describe('判斷順序', () => {
  test('關掉的優先於其他所有條件', () => {
    assert.equal(popupSkipReason({
      ...base, enabled: false, pathname: '/cart',
      lastShownAt: Date.now(), hideAfter: '2020-01-01' }), 'disabled')
  })

  test('過期優先於冷卻', () => {
    assert.equal(popupSkipReason({
      ...base, now: new Date('2026-12-01T00:00:00+08:00'),
      lastShownAt: Date.now() }), 'expired')
  })
})
