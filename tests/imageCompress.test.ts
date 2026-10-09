import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { targetSize, preferCompressed, renameForType, MAX_EDGE } from '../lib/imageCompress.ts'
import { isOwnStorageUrl, storagePrefix } from '../lib/productImageUrl.ts'

describe('圖片壓縮尺寸', () => {
  test('長邊超過上限時等比例縮小', () => {
    assert.deepEqual(targetSize(4000, 3000), { width: MAX_EDGE, height: 1200 })
    assert.deepEqual(targetSize(3000, 4000), { width: 1200, height: MAX_EDGE })
    assert.deepEqual(targetSize(3840, 2160, 1920), { width: 1920, height: 1080 })
  })
  test('本來就小的圖不放大', () => {
    assert.deepEqual(targetSize(800, 600), { width: 800, height: 600 })
  })
  test('壞掉的尺寸不會算出 NaN', () => {
    assert.deepEqual(targetSize(0, 0), { width: 0, height: 0 })
    assert.deepEqual(targetSize(NaN, 100), { width: 0, height: 0 })
  })
})

describe('壓完要不要用', () => {
  test('明顯變小才用壓縮版', () => {
    assert.equal(preferCompressed({ type: 'image/png', size: 3_000_000 }, 300_000), true)
    assert.equal(preferCompressed({ type: 'image/webp', size: 200_000 }, 190_000), false)
  })
  test('GIF 可能是動圖，一律保留原檔', () => {
    assert.equal(preferCompressed({ type: 'image/gif', size: 3_000_000 }, 100), false)
  })
  test('壓縮失敗（0 位元組）時保留原檔', () => {
    assert.equal(preferCompressed({ type: 'image/png', size: 3_000_000 }, 0), false)
  })
  test('副檔名跟著實際格式改', () => {
    assert.equal(renameForType('商品照.PNG', 'image/webp'), '商品照.webp')
    assert.equal(renameForType('a.b.jpeg', 'image/jpeg'), 'a.b.jpg')
    assert.equal(renameForType('noext', 'image/webp'), 'noext.webp')
  })
})

describe('只能換成自己儲存空間的圖片', () => {
  const base = 'https://abc.supabase.co'
  const ok = storagePrefix(base) + 'products/1776674318115-xy6nbpvkro.png'
  test('自己的商品圖', () => {
    assert.equal(isOwnStorageUrl(ok, base), true)
    assert.equal(isOwnStorageUrl(ok, base + '/'), true)
  })
  test('外部網址、其他 bucket、路徑跳脫、帶參數都不接受', () => {
    for (const bad of [
      'https://evil.example/x.png',
      `${base}/storage/v1/object/public/other-bucket/x.png`,
      storagePrefix(base) + '../secret.png',
      storagePrefix(base) + 'products//x.png',
      ok + '?download=1',
      'https://abc.supabase.co.evil.example/storage/v1/object/public/product-images/x.png',
      null, 123,
    ]) assert.equal(isOwnStorageUrl(bad, base), false, String(bad))
  })
  test('沒有設定 Supabase 網址時一律拒絕', () => {
    assert.equal(isOwnStorageUrl(ok, ''), false)
  })
})
