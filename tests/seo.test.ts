import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSiteUrl } from '../lib/siteUrl.ts'
import { lowestActivePrice, isInStock } from '../lib/productPricing.ts'

const FALLBACK = 'https://www.88ziyishequn.com'

function variant(over: Record<string, unknown> = {}) {
  return { id: 1, is_active: true, stock_qty: 10, sale_price: 600, ...over }
}

describe('正式網址（canonical / sitemap 的來源）', () => {
  test('未設定環境變數時用品牌網域，不是 Vercel 部署網址', () => {
    // 原本 13 個檔案寫死 healthec.vercel.app，等於叫 Google
    // 把權重算到部署網址上
    assert.equal(normalizeSiteUrl(undefined), FALLBACK)
    assert.equal(normalizeSiteUrl(''), FALLBACK)
    assert.equal(normalizeSiteUrl('   '), FALLBACK)
  })

  test('正常設定原樣使用', () => {
    assert.equal(normalizeSiteUrl('https://www.88ziyishequn.com'), 'https://www.88ziyishequn.com')
    assert.equal(normalizeSiteUrl('https://example.com'), 'https://example.com')
  })

  test('結尾斜線會去掉，否則組出來是 //products/xxx', () => {
    assert.equal(normalizeSiteUrl('https://www.88ziyishequn.com/'), FALLBACK)
    assert.equal(normalizeSiteUrl('https://www.88ziyishequn.com///'), FALLBACK)
  })

  test('格式錯誤的值退回品牌網域，不產生壞掉的 canonical', () => {
    for (const bad of ['88ziyishequn.com', 'ftp://x.com', 'https://', 'https://a.com/path', 'not a url']) {
      assert.equal(normalizeSiteUrl(bad), FALLBACK, `失敗於 ${bad}`)
    }
  })
})

describe('商品結構化資料的價格與庫存', () => {
  test('取可購買規格的最低價', () => {
    // 紫蘇籽油：250ml NT$600、兩瓶組 NT$1100 → 顯示 600
    const p = { product_variants: [variant({ sale_price: 1100 }), variant({ sale_price: 600 })] }
    assert.equal(lowestActivePrice(p), 600)
  })

  test('停用的規格不算價格 —— 否則 Google 顯示一個買不到的金額', () => {
    const p = { product_variants: [variant({ sale_price: 100, is_active: false }), variant({ sale_price: 600 })] }
    assert.equal(lowestActivePrice(p), 600)
  })

  test('沒有可購買規格時回 null（JSON-LD 就不放 offers）', () => {
    assert.equal(lowestActivePrice({ product_variants: [] }), null)
    assert.equal(lowestActivePrice({ product_variants: [variant({ is_active: false })] }), null)
    assert.equal(lowestActivePrice({}), null)
    assert.equal(lowestActivePrice(null), null)
  })

  test('價格為 0 或非數字不採用，不會變成 NT$0', () => {
    assert.equal(lowestActivePrice({ product_variants: [variant({ sale_price: 0 })] }), null)
    assert.equal(lowestActivePrice({ product_variants: [variant({ sale_price: null })] }), null)
    assert.equal(
      lowestActivePrice({ product_variants: [variant({ sale_price: 0 }), variant({ sale_price: 600 })] }), 600)
  })

  test('庫存狀態：任一可購買規格有貨即為有貨', () => {
    assert.equal(isInStock({ product_variants: [variant({ stock_qty: 0 }), variant({ stock_qty: 3 })] }), true)
    assert.equal(isInStock({ product_variants: [variant({ stock_qty: 0 })] }), false)
    // 停用的規格就算有庫存也買不到
    assert.equal(isInStock({ product_variants: [variant({ stock_qty: 99, is_active: false })] }), false)
    assert.equal(isInStock({ product_variants: [] }), false)
    assert.equal(isInStock(null), false)
  })
})
