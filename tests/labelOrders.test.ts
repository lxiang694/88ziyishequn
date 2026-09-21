import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseOrderList, reconcile } from '../lib/myship/labelOrders.ts'

/** 站上真實的訂單號 */
const A = 'CM2609214719432'
const B = 'CM2609214719459'
const C = 'CM2609214719479'

describe('面單處理：解析貼上的訂單號', () => {
  test('一行一筆', () => {
    assert.deepEqual(parseOrderList(`${A}\n${B}\n${C}`).orderNos, [A, B, C])
  })

  test('逗號、頓號、空白、Tab 都能當分隔', () => {
    for (const sep of [',', '，', '、', ' ', '\t', ' , ']) {
      assert.deepEqual(parseOrderList([A, B].join(sep)).orderNos, [A, B], `分隔符 ${JSON.stringify(sep)}`)
    }
  })

  test('面單上的 -0 後綴會被去掉', () => {
    // PDF 裡寫的是「寄貨訂單編號：CM2609214719432-0」
    assert.deepEqual(parseOrderList(`${A}-0\n${B}-1`).orderNos, [A, B])
  })

  test('整塊複製、中間夾雜其他文字也抓得到', () => {
    // 從賣貨便畫面整塊複製的樣子
    const pasted = `
      2026/09/21  一般賣場 張先生代購批發
      CC2609211398160
      ${C}  訂單明細
      取貨付款 (尚未付款)  超商  6  $60
    `
    // CC 開頭的購物車編號不該被當成訂單號
    assert.deepEqual(parseOrderList(pasted).orderNos, [C])
  })

  test('重複貼到會去重並提醒', () => {
    const r = parseOrderList(`${A}\n${B}\n${A}`)
    assert.deepEqual(r.orderNos, [A, B])
    assert.deepEqual(r.duplicates, [A])
    assert.ok(r.warnings.some(w => w.includes('重複')))
  })

  test('全形英數也吃得下', () => {
    const full = A.replace(/./g, ch => String.fromCharCode(ch.charCodeAt(0) + 0xfee0))
    assert.deepEqual(parseOrderList(full).orderNos, [A])
  })

  test('保留第一次出現的順序', () => {
    assert.deepEqual(parseOrderList(`${C}\n${A}\n${B}`).orderNos, [C, A, B])
  })

  test('空白或沒有訂單號時給明確提醒，不是靜默回空', () => {
    for (const empty of ['', '   ', '\n\n', null, undefined]) {
      const r = parseOrderList(empty as any)
      assert.deepEqual(r.orderNos, [])
      assert.ok(r.warnings.length > 0, `失敗於 ${JSON.stringify(empty)}`)
    }
    const noMatch = parseOrderList('今天要出三筆，麻煩了')
    assert.deepEqual(noMatch.orderNos, [])
    assert.ok(noMatch.warnings[0].includes('CM'))
  })

  test('位數不對的不會被誤抓', () => {
    assert.deepEqual(parseOrderList('CM26092147194').orderNos, [])      // 11 位
    assert.deepEqual(parseOrderList('CM260921471943').orderNos, [])     // 12 位
  })

  test('多一位的號碼整串不認，不會被截成另一筆真實訂單', () => {
    // 打錯多按一個數字時，如果截前 13 位，會得到一個合法但可能
    // 對應到別筆訂單的號碼 —— 那比直接不認還危險
    assert.deepEqual(parseOrderList('CM26092147194321').orderNos, [])
    // 混在清單裡時，正確的那些照樣抓得到，錯的那筆整串跳過
    assert.deepEqual(parseOrderList(`${A}\nCM26092147194321\n${B}`).orderNos, [A, B])
  })
})

describe('面單處理：對帳', () => {
  test('全部對上', () => {
    const r = reconcile([A, B, C], [A, B, C])
    assert.deepEqual(r.matched, [A, B, C])
    assert.deepEqual(r.missing, [])
    assert.deepEqual(r.extra, [])
  })

  test('漏印：清單上有，PDF 裡沒有', () => {
    // 三個賣場挑訂單時最容易發生的錯
    const r = reconcile([A, B, C], [A, C])
    assert.deepEqual(r.matched, [A, C])
    assert.deepEqual(r.missing, [B])
  })

  test('多印：PDF 裡有，清單上沒有 —— 不放進 ZIP', () => {
    const r = reconcile([A], [A, B])
    assert.deepEqual(r.matched, [A])
    assert.deepEqual(r.extra, [B])
    // 貨沒有要出，面單傳上去會讓倉庫等一個不會到的包裹
    assert.equal(r.matched.includes(B), false)
  })

  test('同時漏印與多印', () => {
    const r = reconcile([A, B], [B, C])
    assert.deepEqual(r.matched, [B])
    assert.deepEqual(r.missing, [A])
    assert.deepEqual(r.extra, [C])
  })

  test('PDF 裡同一張面單重複出現時只算一次', () => {
    const r = reconcile([A], [A, A])
    assert.deepEqual(r.matched, [A])
    assert.deepEqual(r.extra, [])
  })

  test('matched 維持清單的順序，不是 PDF 的順序', () => {
    // 產出的 ZIP 依使用者貼的順序，比較好核對
    assert.deepEqual(reconcile([C, A, B], [A, B, C]).matched, [C, A, B])
  })

  test('空輸入不會爆', () => {
    assert.deepEqual(reconcile([], []), { matched: [], missing: [], extra: [] })
    assert.deepEqual(reconcile([A], []).missing, [A])
    assert.deepEqual(reconcile([], [A]).extra, [A])
  })
})
