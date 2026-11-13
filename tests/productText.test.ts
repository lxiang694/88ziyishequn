import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArticle } from '../lib/articleBlocks.ts'
import { polishProductBlocks, splitLongParagraph, cleanPastedText } from '../lib/productText.ts'

const types = (text: string) => polishProductBlocks(parseArticle(text)).map(b => b.type)

test('截圖那段牙刷文案：開頭變導言、長段切小段', () => {
  const copy = [
    '🪥 這款牙刷，我自己用了快一年，今天終於上架了！',
    '其實這款牙刷之前就有分享給一些朋友，不少人買過之後又回來回購。我自己也一直在用，用到現在快一年了，覺得確實不錯，才想正式上架分享給大家。',
    '以前總覺得牙刷嘛，能刷乾淨就好，後來才慢慢發現，牙刷還真的不能隨便挑。',
  ].join('\n\n')
  const blocks = polishProductBlocks(parseArticle(copy))
  assert.equal(blocks[0].type, 'lead')
  // 第二段 70 多字：不切
  assert.deepEqual(blocks.map(b => b.type), ['lead', 'p', 'p'])
})

test('超過 75 字的長段落依句子切開，最後的短句併回前一段', () => {
  const long = '每天早晚都在刷牙，如果刷毛太硬、刷頭太大，或是刷牙方式不對，不但有些地方刷不到，還可能把牙齦刷得不舒服。所以挑牙刷的時候，我會先看刷毛軟硬、刷頭大小，還有握起來順不順手。這三點對了，刷起來就舒服很多。好用。'
  const parts = splitLongParagraph(long)
  assert.ok(parts.length >= 2)
  assert.equal(parts.join(''), long) // 一個字都不少
  assert.ok(parts.every(p => p.length >= 20))
  assert.deepEqual(splitLongParagraph('短短一段。'), ['短短一段。'])
})

test('問句、冒號結尾的短句變小標；✅ 開頭的連續行變條列', () => {
  assert.deepEqual(types('為什麼推薦這款？\n\n因為刷毛很細，牙縫也刷得到。'), ['h3', 'p'])
  assert.deepEqual(types('使用方式：\n\n每天早晚各一次。'), ['h3', 'p'])
  assert.deepEqual(types('前言說明一下。\n\n✅ 刷毛細軟\n✅ 刷頭小巧\n✅ 好握不滑'), ['p', 'ul'])
  assert.deepEqual(types('✅ 刷毛細軟\n✅ 刷頭小巧\n\n每天早晚各一次。'), ['ul', 'p'])  // 一開頭就是條列，不當導言
  const ul = polishProductBlocks(parseArticle('前言說明一下。\n\n✅ 刷毛細軟\n✅ 刷頭小巧')).find(b => b.type === 'ul') as { items: string[] }
  assert.deepEqual(ul.items, ['刷毛細軟', '刷頭小巧'])
})

test('保守：規格行、只有一行、最後一行問句都不動', () => {
  assert.deepEqual(types('材質：艾絨'), ['p'])
  assert.deepEqual(types('你也有這種困擾嗎？'), ['p'])                // 後面沒內容，不當標題
  assert.deepEqual(types('保存方式：常溫保存，避免日照。\n\n開封後請盡快食用。'), ['p', 'p']) // 有句號，不是標題
  assert.deepEqual(types('只有一句話！'), ['p'])                     // 只有一段不做導言
})

test('截圖的咖啡壺文案：「產品特色」變小標、「01｜…」變特色卡（說明包在卡裡）', () => {
  const copy = [
    '產品特色',
    '01｜螺旋紋玻璃濾杯',
    '濾杯採用立體螺旋紋路設計，搭配合適的濾紙與注水方式，幫助水流通過咖啡粉。',
    '透明玻璃也方便觀察沖泡狀況。',
    '02｜高硼矽玻璃材質',
    '濾杯與分享壺採用高硼矽玻璃，適合日常冷熱飲沖泡使用。',
    '03｜胡桃木托架',
    '玻璃搭配胡桃木，整體看起來簡單、自然。',
  ].join('\n\n')
  const blocks = polishProductBlocks(parseArticle(copy)) as any[]
  assert.deepEqual(blocks.map(b => b.type), ['h3', 'feature', 'feature', 'feature'])
  assert.equal(blocks[0].text, '產品特色')
  assert.deepEqual([blocks[1].num, blocks[1].title, blocks[1].body.length], ['01', '螺旋紋玻璃濾杯', 2])
  assert.equal(blocks[3].body[0].text, '玻璃搭配胡桃木，整體看起來簡單、自然。')
})

test('連續三行以上的短句變條列；一兩行不動；最後一行短句不當標題', () => {
  assert.deepEqual(types('長時間使用電腦的人\n\n肩頸容易緊繃的人\n\n每天開車的人'), ['ul'])
  assert.deepEqual(types('好用推薦\n\n每天早晚都可以用，很方便。'), ['h3', 'p'])
  assert.deepEqual(types('前面一段完整的句子。\n\n常溫保存'), ['p', 'p'])
  // 特色卡遇到下一個小標就結束
  const b = polishProductBlocks(parseArticle('01｜第一點\n\n說明一。\n\n使用方式\n\n每天一次，飯後食用。')) as any[]
  assert.deepEqual(b.map(x => x.type), ['feature', 'h3', 'p'])
})

test('貼上清理：只清看不見的東西，文字一個不改', () => {
  const pasted = '　產品特色​  \r\n\r\n\r\n\r\n01｜螺旋紋玻璃濾杯\t\n濾杯採用  立體設計。  '
  assert.equal(cleanPastedText(pasted), '產品特色\n\n01｜螺旋紋玻璃濾杯\n濾杯採用 立體設計。')
})

test('「適合誰」後面接一串短句：適合誰是標題、後面是條列，而且會結束前一張特色卡', () => {
  const b = polishProductBlocks(parseArticle('03｜胡桃木托架\n\n玻璃搭配胡桃木。\n\n適合誰\n\n喜歡手沖咖啡的人\n\n想在家慢慢喝一杯的人\n\n送禮給愛喝咖啡的朋友')) as any[]
  assert.deepEqual(b.map(x => x.type), ['feature', 'h3', 'ul'])
  assert.equal(b[1].text, '適合誰')
  assert.equal(b[2].items.length, 3)
})
