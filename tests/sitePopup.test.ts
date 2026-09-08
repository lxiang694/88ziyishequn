import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickPopup, isWithinWindow, isPathAllowed, pathMatches,
  storageKeyFor, isInCooldown, toPublicPopup, twToday,
  type PopupRow,
} from '../lib/popups/domain.ts'

const base: PopupRow = {
  id: 1, name: '茶油預售', badge_text: '預售中', title: '野生茶籽油',
  body: '山上還在採', price_text: 'NT$1,350', image_url: null,
  cta_text: '看看這批油', link_path: '/camellia-oil', product_slug: 'wild-camellia-oil',
  is_active: true, priority: 100,
  delay_ms: 800, auto_close_ms: 5000, cooldown_hours: 12,
  starts_at: null, ends_at: null,
  include_paths: [], exclude_paths: ['/cart', '/checkout', '/order-success'],
}
const now = new Date('2026-09-01T10:00:00+08:00')

describe('期間', () => {
  test('沒設期間就永遠有效', () => {
    assert.equal(isWithinWindow({ starts_at: null, ends_at: null }, now), true)
  })
  test('還沒開始不顯示', () => {
    assert.equal(isWithinWindow({ starts_at: '2026-09-02', ends_at: null }, now), false)
  })
  test('開始當天就顯示', () => {
    assert.equal(isWithinWindow({ starts_at: '2026-09-01', ends_at: null }, now), true)
  })
  test('結束當天仍然顯示（不會提早消失）', () => {
    assert.equal(isWithinWindow({ starts_at: null, ends_at: '2026-09-01' }, now), true)
  })
  test('過了結束日就不顯示', () => {
    assert.equal(isWithinWindow({ starts_at: null, ends_at: '2026-08-31' }, now), false)
  })
  test('用台灣日期判斷，不會被時區砍掉一天', () => {
    // UTC 還是 8/31 23:00，台灣已經是 9/1
    const lateNight = new Date('2026-08-31T23:00:00Z')
    assert.equal(twToday(lateNight), '2026-09-01')
  })
})

describe('路徑規則', () => {
  test('子路徑也算命中', () => {
    assert.equal(pathMatches('/checkout/confirm', ['/checkout']), true)
  })
  test('只是開頭相同的其他路徑不算', () => {
    assert.equal(pathMatches('/cartoon', ['/cart']), false)
  })
  test('排除路徑不顯示', () => {
    for (const p of ['/cart', '/checkout', '/order-success']) {
      assert.equal(isPathAllowed(base, p), false, `${p} 應該被排除`)
    }
  })
  test('已經在目的地頁面就不再彈', () => {
    assert.equal(isPathAllowed(base, '/camellia-oil'), false)
  })
  test('沒設 include 就全站顯示', () => {
    assert.equal(isPathAllowed(base, '/'), true)
    assert.equal(isPathAllowed(base, '/products/abc'), true)
  })
  test('設了 include 就只在那些路徑顯示', () => {
    const row = { ...base, include_paths: ['/products'] }
    assert.equal(isPathAllowed(row, '/products/abc'), true)
    assert.equal(isPathAllowed(row, '/'), false)
  })
})

describe('同時只顯示一個', () => {
  test('取優先順序最大的', () => {
    const a = { ...base, id: 1, priority: 10 }
    const b = { ...base, id: 2, priority: 99, link_path: '/b' }
    assert.equal(pickPopup([a, b], '/', now)!.id, 2)
  })
  test('優先順序相同時取較新的（id 大）', () => {
    const a = { ...base, id: 1, priority: 50 }
    const b = { ...base, id: 7, priority: 50, link_path: '/b' }
    assert.equal(pickPopup([a, b], '/', now)!.id, 7)
  })
  test('關掉的不列入', () => {
    const off = { ...base, id: 3, priority: 999, is_active: false }
    const on = { ...base, id: 4, priority: 1, link_path: '/b' }
    assert.equal(pickPopup([off, on], '/', now)!.id, 4)
  })
  test('過期的不列入，優先順序再高也一樣', () => {
    const expired = { ...base, id: 5, priority: 999, ends_at: '2026-08-01' }
    const ok = { ...base, id: 6, priority: 1, link_path: '/b' }
    assert.equal(pickPopup([expired, ok], '/', now)!.id, 6)
  })
  test('全部都不符合就回 null', () => {
    assert.equal(pickPopup([{ ...base, is_active: false }], '/', now), null)
    assert.equal(pickPopup([], '/', now), null)
  })
  test('在排除路徑上一個都不顯示', () => {
    assert.equal(pickPopup([base], '/checkout', now), null)
  })
})

describe('冷卻', () => {
  test('每個彈窗各自記錄，換一個不會被上一個擋住', () => {
    assert.notEqual(storageKeyFor(1), storageKeyFor(2))
  })
  test('沒看過就會顯示', () => {
    assert.equal(isInCooldown(null, 12, now), false)
  })
  test('冷卻期內不顯示', () => {
    assert.equal(isInCooldown(now.getTime() - 3600_000, 12, now), true)
  })
  test('超過冷卻期就會再顯示', () => {
    assert.equal(isInCooldown(now.getTime() - 13 * 3600_000, 12, now), false)
  })
  test('冷卻設 0 代表每次都顯示', () => {
    assert.equal(isInCooldown(now.getTime(), 0, now), false)
  })
})

describe('對外欄位', () => {
  test('不外流後台自用欄位', () => {
    const pub: any = toPublicPopup(base)
    for (const leaked of ['name', 'created_by_admin_id', 'created_at', 'updated_at']) {
      assert.equal(leaked in pub, false, `外洩了 ${leaked}`)
    }
    assert.equal(pub.title, '野生茶籽油')
  })
})
