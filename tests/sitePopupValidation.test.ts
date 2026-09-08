import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parsePopupInput, parsePath, PopupInputError } from '../lib/popups/validation.ts'

const ok = {
  name: '茶油預售', title: '野生茶籽油', cta_text: '看看這批油', link_path: '/camellia-oil',
}

describe('連結路徑', () => {
  test('站內路徑通過', () => {
    assert.equal(parsePath('/camellia-oil', '連結'), '/camellia-oil')
  })
  test('外部網址被擋', () => {
    assert.throws(() => parsePath('https://evil.example', '連結'), PopupInputError)
  })
  test('protocol-relative 網址被擋（瀏覽器會當成外部）', () => {
    assert.throws(() => parsePath('//evil.example', '連結'), PopupInputError)
  })
  test('帶參數被擋（會進到 log 與 analytics）', () => {
    assert.throws(() => parsePath('/a?b=1', '連結'), PopupInputError)
    assert.throws(() => parsePath('/a#b', '連結'), PopupInputError)
  })
  test('沒有斜線開頭被擋', () => {
    assert.throws(() => parsePath('camellia-oil', '連結'), PopupInputError)
  })
})

describe('必填與限長', () => {
  test('完整輸入通過', () => {
    const out = parsePopupInput(ok)
    assert.equal(out.title, '野生茶籽油')
    assert.equal(out.link_path, '/camellia-oil')
  })
  test('缺必填會擋下', () => {
    assert.throws(() => parsePopupInput({ ...ok, title: '' }), PopupInputError)
    assert.throws(() => parsePopupInput({ ...ok, name: '' }), PopupInputError)
    assert.throws(() => parsePopupInput({ ...ok, link_path: '' }), PopupInputError)
  })
  test('超長會擋下', () => {
    assert.throws(() => parsePopupInput({ ...ok, title: 'x'.repeat(41) }), PopupInputError)
    assert.throws(() => parsePopupInput({ ...ok, body: 'x'.repeat(121) }), PopupInputError)
  })
})

describe('預設值與安全預設', () => {
  test('沒填數值時給合理預設', () => {
    const out = parsePopupInput(ok)
    assert.equal(out.delay_ms, 800)
    assert.equal(out.auto_close_ms, 5000)
    assert.equal(out.cooldown_hours, 12)
    assert.equal(out.priority, 0)
  })
  test('is_active 預設是關的 —— 內容還沒檢查過不該直接對全站顯示', () => {
    assert.equal(parsePopupInput(ok).is_active, false)
    assert.equal(parsePopupInput({ ...ok, is_active: 'true' }).is_active, false)
    assert.equal(parsePopupInput({ ...ok, is_active: true }).is_active, true)
  })
  test('數值超出範圍會擋下', () => {
    assert.throws(() => parsePopupInput({ ...ok, delay_ms: -1 }), PopupInputError)
    assert.throws(() => parsePopupInput({ ...ok, cooldown_hours: 9999 }), PopupInputError)
  })
})

describe('日期', () => {
  test('格式錯誤會擋下', () => {
    assert.throws(() => parsePopupInput({ ...ok, ends_at: '2026/10/31' }), PopupInputError)
  })
  test('結束早於開始會擋下', () => {
    assert.throws(() => parsePopupInput({
      ...ok, starts_at: '2026-10-31', ends_at: '2026-10-01' }), PopupInputError)
  })
  test('空字串視為不限', () => {
    const out = parsePopupInput({ ...ok, starts_at: '', ends_at: '' })
    assert.equal(out.starts_at, null)
    assert.equal(out.ends_at, null)
  })
})

describe('路徑清單', () => {
  test('換行分隔的多筆路徑', () => {
    const out = parsePopupInput({ ...ok, exclude_paths: '/cart\n/checkout' })
    assert.deepEqual(out.exclude_paths, ['/cart', '/checkout'])
  })
  test('清單裡的外部網址一樣被擋', () => {
    assert.throws(() => parsePopupInput({
      ...ok, exclude_paths: '/cart\nhttps://evil.example' }), PopupInputError)
  })
  test('空白行被忽略', () => {
    const out = parsePopupInput({ ...ok, include_paths: '\n/products\n\n' })
    assert.deepEqual(out.include_paths, ['/products'])
  })
})

describe('圖片網址', () => {
  test('http/https 通過', () => {
    assert.equal(parsePopupInput({ ...ok, image_url: 'https://a.com/b.jpg' }).image_url,
      'https://a.com/b.jpg')
  })
  test('javascript: 之類的被擋', () => {
    assert.throws(() => parsePopupInput({
      ...ok, image_url: 'javascript:alert(1)' }), PopupInputError)
  })
  test('空值變 null', () => {
    assert.equal(parsePopupInput({ ...ok, image_url: '' }).image_url, null)
  })
})
