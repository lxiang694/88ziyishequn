import { test } from 'node:test'
import assert from 'node:assert/strict'
import { insertImage, isSafeImageUrl, listImages, removeImageLine } from '../lib/groupBuy/textImages.ts'
import { parseArticle } from '../lib/articleBlocks.ts'
import { normalizeGroupBuyText } from '../lib/groupBuy/text.ts'

const U = 'https://x.supabase.co/storage/v1/object/public/images/a.jpg'

test('插入圖片：自成一行，不黏前後文字', () => {
  assert.deepEqual(insertImage('', 0, U), { text: `![](${U})\n`, cursor: U.length + 6 })
  const mid = insertImage('第一段第二段', 3, U)
  assert.equal(mid.text, `第一段\n![](${U})\n第二段`)
  assert.equal(mid.text.slice(0, mid.cursor), `第一段\n![](${U})\n`)
  assert.equal(insertImage('第一段\n第二段', 4, U).text, `第一段\n![](${U})\n第二段`)
  assert.equal(insertImage('結尾', 99, U).text, `結尾\n![](${U})\n`)
})

test('列出與移除圖片', () => {
  const text = `介紹\n![](${U})\n\n保存方式\n![說明](https://a.b/c.png)`
  assert.deepEqual(listImages(text), [{ line: 1, url: U }, { line: 4, url: 'https://a.b/c.png' }])
  assert.equal(removeImageLine(text, 1), '介紹\n\n保存方式\n![說明](https://a.b/c.png)')
  assert.equal(removeImageLine(text, 0), text) // 不是圖片的行不動
})

test('前台解析得出圖片，品牌符號處理不影響圖片行', () => {
  const blocks = parseArticle(normalizeGroupBuyText(`◆ 台灣養殖\n![](${U})\n【保存方式】`))
  assert.deepEqual(blocks.map(b => b.type), ['ul', 'image', 'h3'])
  assert.equal(isSafeImageUrl(U), true)
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false)
})
