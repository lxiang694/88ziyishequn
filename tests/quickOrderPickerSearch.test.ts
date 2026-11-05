import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanQuery, queryTokens, searchCatalog } from '../lib/quickOrder/pickerSearch.ts'

const p = (product_name: string, variant_name = '1瓶', sku_code: string | null = null) => ({ product_name, product_variants: [{ variant_name, sku_code }] })
const catalog = [p('6合一綜合維生素', '4瓶', 'A043'), p('金盞花葉黃素', '1瓶（60顆）', 'A010'), p('紫蘇籽油', '1瓶（250ml）'), p('晚安足浴包', '1盒（10包）')]

test('拿掉數量寫法、拆成片段', () => {
  assert.equal(cleanQuery('葉黃素軟膠囊X2'), '葉黃素軟膠囊')
  assert.equal(cleanQuery('紫蘇油 2瓶'), '紫蘇油')
  assert.deepEqual(queryTokens('葉黃素'), ['葉黃', '黃素'])
  assert.deepEqual(queryTokens('20mg 葉黃'), ['20mg', '葉黃'])
  assert.deepEqual(queryTokens(''), [])
})

test('LINE 上的寫法跟商品名不完全一樣也找得到，最像的排前面', () => {
  assert.equal(searchCatalog(catalog, '葉黃素軟膠囊X2')[0].product_name, '金盞花葉黃素')
  assert.equal(searchCatalog(catalog, '紫蘇油')[0].product_name, '紫蘇籽油')
  assert.equal(searchCatalog(catalog, '足浴')[0].product_name, '晚安足浴包')
  assert.equal(searchCatalog(catalog, 'a043')[0].product_name, '6合一綜合維生素') // 用貨號找
  assert.deepEqual(searchCatalog(catalog, '魚油'), [])
  assert.equal(searchCatalog(catalog, '').length, 4)
})
