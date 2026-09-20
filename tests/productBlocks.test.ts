import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseArticle } from '../lib/articleBlocks.ts'

/**
 * 商品描述欄位的排版。
 *
 * 這裡測的是解析結果（parseArticle 的輸出），不是 React 樹 ——
 * 「一段文字該變成幾個區塊、哪些是條列」才是會出錯的地方；
 * 樣式類別在測試裡驗證沒有意義。
 *
 * 用的都是後台實際會貼進來的內容形狀。
 */

describe('商品描述欄位的排版', () => {
  test('「•」開頭的行要變成條列，不是一段文字', () => {
    // AI 產生器與後台輸入最常見的形狀
    const blocks = parseArticle(
      '• 三餐外食、蔬果吃得少的人\n• 作息不規律、常熬夜的上班族\n• 想補充日常基礎營養的人')
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].type, 'ul')
    assert.deepEqual((blocks[0] as any).items, [
      '三餐外食、蔬果吃得少的人',
      '作息不規律、常熬夜的上班族',
      '想補充日常基礎營養的人',
    ])
  })

  test('「- 」開頭同樣是條列', () => {
    const blocks = parseArticle('- 平時較少曬太陽的人\n- 換季時想補充營養的人')
    assert.equal(blocks[0].type, 'ul')
    assert.equal((blocks[0] as any).items.length, 2)
  })

  test('使用方法的編號步驟變成有序清單', () => {
    const blocks = parseArticle('1. 早餐後配溫開水服用\n2. 每日 1 次\n3. 開封後請冷藏')
    assert.equal(blocks[0].type, 'ol')
    assert.deepEqual((blocks[0] as any).items, ['早餐後配溫開水服用', '每日 1 次', '開封後請冷藏'])
  })

  test('「兒童／成人」這種每行一條的用法不會被黏成一行', () => {
    // 截圖裡的實際內容：兩行分別是兒童與成人的份量
    const blocks = parseArticle('兒童：每次 1 錠\n成人：每次 2-4 錠')
    assert.equal(blocks.length, 2)
    assert.equal((blocks[0] as any).text, '兒童：每次 1 錠')
    assert.equal((blocks[1] as any).text, '成人：每次 2-4 錠')
  })

  test('句子中間的換行會被接回去，中文之間不補空格', () => {
    // 從 Word / LINE 貼過來的內容常在句子中間折行
    const blocks = parseArticle('本品為 6 合 1 綜合營養配方，主要成分包含\n維生素 C、維生素 D3 與鋅。')
    assert.equal(blocks.length, 1)
    assert.equal((blocks[0] as any).text, '本品為 6 合 1 綜合營養配方，主要成分包含維生素 C、維生素 D3 與鋅。')
  })

  test('句號結尾的換行才切段', () => {
    const blocks = parseArticle('第一段結束了。\n第二段開始。')
    assert.equal(blocks.length, 2)
  })

  test('條列與段落混用時各自成塊', () => {
    const blocks = parseArticle('每日建議量：\n- 成人每次 2 錠\n- 兒童每次 1 錠\n請配溫開水服用。')
    assert.deepEqual(blocks.map(b => b.type), ['p', 'ul', 'p'])
  })

  test('空欄位不產生任何區塊', () => {
    for (const empty of ['', '   ', '\n\n', null, undefined]) {
      assert.deepEqual(parseArticle(empty as any), [], `失敗於 ${JSON.stringify(empty)}`)
    }
  })

  test('注意事項的多行警語每行獨立', () => {
    const blocks = parseArticle(
      '孕婦、哺乳期婦女請先諮詢醫師。\n對本品任一成分過敏者請勿食用。\n請放置於孩童不易取得處。')
    assert.equal(blocks.length, 3)
    assert.ok(blocks.every(b => b.type === 'p'))
  })

  test('全形空白不會讓條列判斷失效', () => {
    const blocks = parseArticle('•　三餐外食的人\n•　常熬夜的人')
    assert.equal(blocks[0].type, 'ul')
    assert.equal((blocks[0] as any).items.length, 2)
  })
})
