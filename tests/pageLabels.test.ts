import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pageLabel, slugsToLookup } from '../lib/pageLabels.ts'

const names = {
  products: new Map([['nac', 'NAC 乙醯半胱胺酸'], ['小莊代購褪黑素5mg-1778229796176', '褪黑素 5mg']]),
  'health-articles': new Map([['sleep-quality-improvement', '睡不好怎麼辦？']]),
  'group-buy': new Map([['2026-11', '11 月團購｜邱家鱸魚精']]),
}

test('固定頁面', () => {
  assert.equal(pageLabel('/'), '首頁')
  assert.equal(pageLabel('/shop'), '全部商品')
  assert.equal(pageLabel('/cart'), '購物車')
  assert.equal(pageLabel('/checkout/'), '結帳')
  assert.equal(pageLabel('/account/orders'), '會員中心：我的訂單')
})

test('商品分類', () => {
  assert.equal(pageLabel('/shop/nutrition'), '商品分類：營養支持')
  assert.equal(pageLabel('/shop/herbal-paste'), '商品分類：養生膏方')
})

test('商品、文章、團購用資料庫查到的名稱', () => {
  assert.equal(pageLabel('/products/nac', names), '商品：NAC 乙醯半胱胺酸')
  assert.equal(pageLabel('/products/%E5%B0%8F%E8%8E%8A%E4%BB%A3%E8%B3%BC%E8%A4%AA%E9%BB%91%E7%B4%A05mg-1778229796176', names), '商品：褪黑素 5mg')
  assert.equal(pageLabel('/health-articles/sleep-quality-improvement', names), '健康知識：睡不好怎麼辦？')
  assert.equal(pageLabel('/group-buy/2026-11', names), '團購：11 月團購｜邱家鱸魚精')
  assert.equal(pageLabel('/products/gone', names), '商品（已刪除或網址已變更）')
})

test('不認得的路徑原樣顯示', () => {
  assert.equal(pageLabel('/something'), '/something')
})

test('整理要查名稱的代稱', () => {
  const s = slugsToLookup(['/', '/products/nac', '/products/nac', '/health-articles/a', '/shop/tea', '/products/%E9%90%B5%E9%8D%8B'])
  assert.deepEqual(s.products, ['nac', '鐵鍋'])
  assert.deepEqual(s['health-articles'], ['a'])
  assert.deepEqual(s['group-buy'], [])
})
