import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseQuickOrder, parseItems, toHalfWidth, joinPhoneDigits,
} from '../lib/quickOrder/parse.ts'

describe('快速下單：解析貼上的文字', () => {
  test('標準格式', () => {
    const r = parseQuickOrder('張三 0972720032 慶平  20mg 葉黃素軟膠囊X2')
    assert.equal(r.customer_name, '張三')
    assert.equal(r.phone, '0972720032')
    assert.equal(r.store_query, '慶平')
    assert.deepEqual(r.items, [{ raw: '20mg 葉黃素軟膠囊', quantity: 2 }])
    assert.deepEqual(r.warnings, [])
  })

  test('換行版本（客戶在 Line 上常這樣打）', () => {
    const r = parseQuickOrder('張三\n0972720032\n慶平\n20mg 葉黃素軟膠囊X2')
    assert.equal(r.customer_name, '張三')
    assert.equal(r.phone, '0972720032')
    assert.equal(r.store_query, '慶平')
    assert.deepEqual(r.items, [{ raw: '20mg 葉黃素軟膠囊', quantity: 2 }])
  })

  test('商品名稱裡的空白不會被切斷', () => {
    // 這是「照空白切四段」會壞掉的主要原因
    const r = parseQuickOrder('王小明 0912345678 松江 冷壓 紫蘇油 500ml X1')
    assert.equal(r.store_query, '松江')
    assert.deepEqual(r.items, [{ raw: '冷壓 紫蘇油 500ml', quantity: 1 }])
  })

  test('多個商品：空白分隔', () => {
    const r = parseQuickOrder('李四 0987654321 大安 葉黃素X2 紫蘇油X1')
    assert.deepEqual(r.items, [
      { raw: '葉黃素', quantity: 2 },
      { raw: '紫蘇油', quantity: 1 },
    ])
  })

  test('多個商品：頓號與換行分隔', () => {
    const r = parseQuickOrder('李四 0987654321 大安 葉黃素X2、紫蘇油X1\n鐵鍋X1')
    assert.deepEqual(r.items, [
      { raw: '葉黃素', quantity: 2 },
      { raw: '紫蘇油', quantity: 1 },
      { raw: '鐵鍋', quantity: 1 },
    ])
  })

  test('沒寫數量當成 1，不要因此擋下整張單', () => {
    const r = parseQuickOrder('陳先生 0911222333 永和 葉黃素軟膠囊')
    assert.deepEqual(r.items, [{ raw: '葉黃素軟膠囊', quantity: 1 }])
  })

  test('口語數量：2瓶 / 3盒', () => {
    const r = parseQuickOrder('陳先生 0911222333 永和 紫蘇油2瓶、沙棘籽油3盒')
    assert.deepEqual(r.items, [
      { raw: '紫蘇油', quantity: 2 },
      { raw: '沙棘籽油', quantity: 3 },
    ])
  })

  test('規格裡的數字不會被當成數量', () => {
    // 500ml、20mg、30粒裝 都是規格的一部分
    const r = parseQuickOrder('陳先生 0911222333 永和 紫蘇油500ml 30粒裝X1')
    assert.deepEqual(r.items, [{ raw: '紫蘇油500ml 30粒裝', quantity: 1 }])
  })

  test('全形數字與全形字母', () => {
    const r = parseQuickOrder('張三 ０９７２７２００３２ 慶平 葉黃素Ｘ２')
    assert.equal(r.phone, '0972720032')
    assert.deepEqual(r.items, [{ raw: '葉黃素', quantity: 2 }])
  })

  test('手機號碼帶分隔符號', () => {
    assert.equal(parseQuickOrder('張三 0972-720032 慶平 葉黃素X1').phone, '0972720032')
    assert.equal(parseQuickOrder('張三 0972 720 032 慶平 葉黃素X1').phone, '0972720032')
  })

  test('沒有手機號碼 → 明確說找不到，不要硬猜', () => {
    const r = parseQuickOrder('張三 慶平 葉黃素X2')
    assert.equal(r.phone, '')
    assert.equal(r.customer_name, '')
    assert.match(r.warnings[0], /找不到手機號碼/)
  })

  test('市話不會被誤認成手機', () => {
    const r = parseQuickOrder('張三 0223456789 慶平 葉黃素X2')
    assert.equal(r.phone, '')
  })

  test('手機前面多打了一句話 → 取最後一行當姓名並提醒', () => {
    const r = parseQuickOrder('老師我要訂\n張三\n0972720032\n慶平\n葉黃素X1')
    assert.equal(r.customer_name, '張三')
    assert.ok(r.warnings.some(w => w.includes('已忽略')))
  })

  test('缺門市與缺商品都會有提醒', () => {
    const r = parseQuickOrder('張三 0972720032')
    assert.equal(r.store_query, '')
    assert.deepEqual(r.items, [])
    assert.ok(r.warnings.some(w => w.includes('門市')))
    assert.ok(r.warnings.some(w => w.includes('商品')))
  })

  test('空字串不會爆', () => {
    const r = parseQuickOrder('')
    assert.deepEqual(r.items, [])
    assert.ok(r.warnings.length > 0)
  })

  test('數量上限與下限', () => {
    assert.equal(parseItems('葉黃素X0')[0].quantity, 1)
    assert.equal(parseItems('葉黃素X9999')[0].quantity, 1)  // 4 碼不視為數量標記
    assert.equal(parseItems('葉黃素X999')[0].quantity, 999)
  })
})

describe('快速下單：字串正規化', () => {
  test('全形轉半形', () => {
    assert.equal(toHalfWidth('ＡＢＣ１２３'), 'ABC123')
    assert.equal(toHalfWidth('張三　0912'), '張三 0912')  // 全形空白
  })

  test('中文不會被動到', () => {
    assert.equal(toHalfWidth('葉黃素軟膠囊'), '葉黃素軟膠囊')
  })

  test('手機分隔符號接回去，其他數字不動', () => {
    assert.equal(joinPhoneDigits('0972-720032'), '0972720032')
    assert.equal(joinPhoneDigits('500-ml'), '500-ml')
  })
})
