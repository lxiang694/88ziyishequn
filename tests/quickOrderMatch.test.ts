import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchVariants, matchStores, isConfident, similarity,
  stripStoreNoise, normalizeForMatch,
  type ProductRow, type StoreRow,
} from '../lib/quickOrder/match.ts'

function p(
  id: number, name: string,
  variants: [number, string, number, number?][],
  published = true,
): ProductRow {
  return {
    id, product_name: name, cover_image_url: null, is_published: published,
    product_variants: variants.map(([vid, vname, price, stock]) => ({
      id: vid, variant_name: vname, sale_price: price,
      stock_qty: stock ?? 100, sku_code: null, is_active: true,
    })),
  }
}

const PRODUCTS: ProductRow[] = [
  p(1, '葉黃素軟膠囊', [[11, '20mg', 890], [12, '30mg', 1180]]),
  p(2, '冷壓紫蘇油', [[21, '500ml', 1280], [22, '250ml', 720]]),
  p(3, '野生茶籽油', [[31, '500ml', 1350]]),
  p(4, '沙棘籽油', [[41, '30粒', 1580]]),
  p(5, '鑄鐵鍋', [[51, '28cm', 2280]]),
]

describe('快速下單：商品比對', () => {
  test('完整寫法選中正確的商品與規格', () => {
    const r = matchVariants('20mg 葉黃素軟膠囊', PRODUCTS)
    assert.equal(r[0].product_id, 1)
    assert.equal(r[0].variant_id, 11)
    assert.ok(isConfident(r), '這種寫法應該要有把握')
  })

  test('規格寫在後面也一樣', () => {
    const r = matchVariants('葉黃素軟膠囊 30mg', PRODUCTS)
    assert.equal(r[0].variant_id, 12)
  })

  test('規格是區分兩個選項的唯一線索時要選對', () => {
    // 這是最容易錯的一題：商品名一模一樣，只差規格
    assert.equal(matchVariants('葉黃素20mg', PRODUCTS)[0].variant_id, 11)
    assert.equal(matchVariants('葉黃素30mg', PRODUCTS)[0].variant_id, 12)
  })

  test('只寫商品名（沒寫規格）→ 有結果但標記為待確認', () => {
    const r = matchVariants('葉黃素', PRODUCTS)
    assert.equal(r[0].product_id, 1)
    // 兩個規格分數接近，人要自己選
    assert.equal(isConfident(r), false)
  })

  test('只有一個規格的商品，寫商品名就夠', () => {
    const r = matchVariants('野生茶籽油', PRODUCTS)
    assert.equal(r[0].variant_id, 31)
    assert.ok(isConfident(r))
  })

  test('部分字也找得到', () => {
    assert.equal(matchVariants('紫蘇油500ml', PRODUCTS)[0].variant_id, 21)
    assert.equal(matchVariants('紫蘇油250', PRODUCTS)[0].variant_id, 22)
  })

  test('沒上架的商品不會被選到', () => {
    const hidden = [p(9, '葉黃素軟膠囊', [[91, '20mg', 100]], false)]
    assert.equal(matchVariants('葉黃素軟膠囊 20mg', hidden).length, 0)
  })

  test('停用的規格不會被選到', () => {
    const one: ProductRow = {
      id: 7, product_name: '測試品', cover_image_url: null, is_published: true,
      product_variants: [
        { id: 71, variant_name: 'A', sale_price: 1, stock_qty: 1, sku_code: null, is_active: false },
        { id: 72, variant_name: 'B', sale_price: 2, stock_qty: 1, sku_code: null, is_active: true },
      ],
    }
    const r = matchVariants('測試品', [one])
    assert.equal(r.length, 1)
    assert.equal(r[0].variant_id, 72)
  })

  test('完全對不上的字串不該產生有把握的結果', () => {
    const r = matchVariants('腳踏車輪胎', PRODUCTS)
    assert.equal(isConfident(r), false)
  })

  test('空字串回空陣列，不會爆', () => {
    assert.deepEqual(matchVariants('', PRODUCTS), [])
    assert.deepEqual(matchVariants('   ', PRODUCTS), [])
  })

  test('SKU 完全命中直接勝出', () => {
    const withSku: ProductRow[] = [{
      id: 8, product_name: '隨便取的名字', cover_image_url: null, is_published: true,
      product_variants: [{
        id: 81, variant_name: '標準', sale_price: 100,
        stock_qty: 5, sku_code: 'YLS-20', is_active: true,
      }],
    }]
    const r = matchVariants('YLS-20', withSku)
    assert.equal(r[0].variant_id, 81)
    assert.ok(isConfident(r))
  })

  test('回傳帶著價格與庫存，畫面才能先擋庫存不足', () => {
    const r = matchVariants('野生茶籽油', PRODUCTS)
    assert.equal(r[0].unit_price, 1350)
    assert.equal(r[0].stock_qty, 100)
  })
})

describe('快速下單：門市比對', () => {
  const STORES: StoreRow[] = [
    { id: 1, store_code: '123456', store_name: '慶平', county: '台北市', district: '大安區', address: 'A' },
    { id: 2, store_code: '123457', store_name: '慶城', county: '台北市', district: '松山區', address: 'B' },
    { id: 3, store_code: '123458', store_name: '松江', county: '台北市', district: '中山區', address: 'C' },
  ]

  test('完全相同排第一', () => {
    const r = matchStores('慶平', STORES)
    assert.equal(r[0].id, 1)
    assert.equal(r[0].score, 1)
  })

  test('相似的門市也會列出來讓人挑', () => {
    // 慶平與慶城只差一個字，寄錯就是寄到別的區，一定要讓人看到兩個
    const r = matchStores('慶', STORES)
    assert.ok(r.length >= 2)
  })

  test('客戶多寫的「門市」「7-11」不影響比對', () => {
    assert.equal(matchStores('慶平門市', STORES)[0].id, 1)
    assert.equal(matchStores('7-11慶平', STORES)[0].id, 1)
    assert.equal(matchStores('統一超商慶平店', STORES)[0].id, 1)
  })

  test('店號也能直接命中', () => {
    assert.equal(matchStores('123458', STORES)[0].id, 3)
  })

  test('完全不相干的字串回空陣列', () => {
    assert.deepEqual(matchStores('高雄火車站', STORES), [])
  })

  test('去雜訊', () => {
    assert.equal(stripStoreNoise('7-11慶平門市'), '慶平')
    assert.equal(stripStoreNoise('  慶平  '), '慶平')
  })
})

describe('快速下單：相似度', () => {
  test('完全相同為 1', () => {
    assert.equal(similarity('葉黃素', '葉黃素'), 1)
  })

  test('完全不同為 0', () => {
    assert.equal(similarity('葉黃素', '鑄鐵鍋'), 0)
  })

  test('重複字不會被當成完全相同', () => {
    assert.ok(similarity('油油油', '油') < 1)
  })

  test('正規化會去掉空白與大小寫差異', () => {
    assert.equal(normalizeForMatch('20MG 葉黃素'), '20mg葉黃素')
    assert.equal(similarity('20mg葉黃素', '20MG 葉黃素'), 1)
  })
})
