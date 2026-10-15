import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGroupBuyText } from '../lib/groupBuy/text.ts'
import { parseArticle } from '../lib/articleBlocks.ts'

// 實際上架的商品介紹（品牌文案）
const ITEM = `◆ 生態級鮮凍金目鱸全魚，不去鱗滴製
◆ 無添加任何食材、藥材、酒

✱ 經高溫高壓殺菌，可常溫保存，絕無防腐劑

《 商品規格說明 》

▪ 商品規格：一盒 10 包
▪ 有效期限：24 個月`

test('品牌文案的 ◆ ✱ ▪ 變條列、《 》變小標', () => {
  assert.deepEqual(parseArticle(normalizeGroupBuyText(ITEM)), [
    { type: 'ul', items: ['生態級鮮凍金目鱸全魚，不去鱗滴製', '無添加任何食材、藥材、酒'] },
    { type: 'ul', items: ['經高溫高壓殺菌，可常溫保存，絕無防腐劑'] },
    { type: 'h3', text: '商品規格說明' },
    { type: 'ul', items: ['商品規格：一盒 10 包', '有效期限：24 個月'] },
  ])
})

test('團購說明的 Markdown 不再原樣顯示 ## 與 **', () => {
  const blocks = parseArticle(normalizeGroupBuyText('## 邱家兄弟 金目鱸魚精\n\n### 食用方式\n\n**建議每次1包。**\n\n- 蒸蛋\n- 稀飯／粥\n\n---\n\n> 鱸魚精屬於食品，不能取代正餐。'))
  assert.deepEqual(blocks.map(b => b.type), ['h2', 'h3', 'p', 'ul', 'hr', 'quote'])
  assert.ok(!JSON.stringify(blocks).includes('##'))  // 粗體的 ** 由畫面的 inline() 轉成粗體字
})

test('【 】單獨一行也是小標；句中的【】不動', () => {
  assert.equal(normalizeGroupBuyText('【保存方式】'), '### 保存方式')
  assert.equal(normalizeGroupBuyText('本商品【常溫】保存'), '本商品【常溫】保存')
})
