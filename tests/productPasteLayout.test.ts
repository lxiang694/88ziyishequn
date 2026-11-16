import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArticle } from '../lib/articleBlocks.ts'
import { parseProductText } from '../lib/productText.ts'
import { parseFeatureHeading, formatProductLine } from '../lib/productFeatureHeading.ts'
import { featureBlocks, featureTitles, splitSections } from '../lib/productSections.ts'

const titles = ['泡茶喝茶，一杯搞定', '黑陶杯身，簡單耐看', '木質把手，方便拿取', '杯蓋、杯墊兩用']
const descriptions = ['茶葉與茶湯可以分開。', '黑陶杯身搭配浮雕紋路。', '木質把手拿取方便。', '取出濾茶內膽後可暫放杯蓋上。']
const numbered = titles.map((title, i) => `${String(i + 1).padStart(2, '0')}｜${title}`)

test('截圖的四個特色在空行、混合換行、粗體及 Markdown 格式下結果一致', () => {
  for (const transform of [
    (s: string) => s,
    (s: string) => `**${s}**`,
    (s: string) => `### ${s}`,
    (s: string) => `### **${s}**`,
  ]) {
    for (const separator of ['\n', '\n\n']) {
      const copy = '產品特色\n\n' + numbered.map((heading, i) => transform(heading) + separator + descriptions[i]).join('\n\n')
      const sections = splitSections(copy)
      const cards = featureBlocks(sections[0]).filter(b => b.type === 'feature')
      assert.deepEqual(featureTitles(sections), titles)
      assert.equal(cards.length, 4)
      for (let i = 0; i < cards.length; i++) assert.deepEqual(cards[i].body, [{ type: 'p', text: descriptions[i] }])
    }
  }
})

test('全形編號、四種直線及不可見字元共用辨識規則；一般數字與規格不誤判', () => {
  for (const separator of ['｜', '|', '丨', '│']) {
    assert.deepEqual(parseFeatureHeading(`\u200B０１ ${separator} 泡茶喝茶，一杯搞定\uFEFF`), { num: '01', title: titles[0] })
  }
  for (const text of ['500mg', '01. 每日一錠', '材質：陶瓷', '01｜', '01｜' + '字'.repeat(61)]) assert.equal(parseFeatureHeading(text), null)
  assert.equal(splitSections('產\u200B品特色\n０１｜黑陶杯身，簡單耐看\n說明。')[0].kind, 'features')
  // 文章頁保持原本的 Markdown 分段行為，商品頁才使用特色卡的邊界。
  assert.equal(parseArticle('01｜標題\n說明。\n\n其他文字。')[0].type, 'p')
})

test('下一個特色或章節會結束前一張卡，規格與注意事項完整保留', () => {
  const copy = '產品特色\n01｜木質把手，方便拿取\n說明。\n\n注意事項\n請小心拿取熱飲。\n\n成分規格\n材質：陶瓷\n配件：杯蓋'
  const sections = splitSections(copy)
  assert.deepEqual(sections.map(s => s.kind), ['features', 'caution', 'spec'])
  assert.deepEqual(featureBlocks(sections[0])[0], { type: 'feature', num: '01', title: titles[2], body: [{ type: 'p', text: '說明。' }] })
  assert.equal(sections[1].body, '請小心拿取熱飲。')
  assert.equal(sections[2].body, '材質：陶瓷\n配件：杯蓋')
})

test('摘要、編號卡及標籤式特色的標題與數量一致', () => {
  const sections = splitSections('產品特色\n好拿取：木質把手。\n好沖泡：附濾茶內膽。\n\n【其他設計】\n03｜杯蓋、杯墊兩用\n說明。')
  assert.deepEqual(featureTitles(sections), ['好拿取', '好沖泡', titles[3]])
  assert.equal(sections.flatMap(featureBlocks).filter(b => b.type === 'feature').length, 3)
})

test('手動指定僅修改游標所在行，取消格式可回到一般內文', () => {
  const source = '產品特色\n\n01｜原有特色\n說明。\n\n新的特色，方便閱讀\n這是說明。'
  const start = source.indexOf('新的特色')
  const formatted = formatProductLine(source, start, start, true)
  assert.ok('value' in formatted)
  assert.equal(formatted.value, source.replace('新的特色，方便閱讀', '### 02｜新的特色，方便閱讀'))
  const plain = formatProductLine(formatted.value, formatted.start, formatted.end, false)
  assert.ok('value' in plain)
  assert.equal(plain.value, source.replace('新的特色，方便閱讀', '\\新的特色，方便閱讀'))
  assert.deepEqual(parseProductText('\\使用方法'), [{ type: 'p', text: '使用方法', literal: true }])
  assert.equal(splitSections('\\使用方法')[0].kind, 'intro')
  assert.ok('error' in formatProductLine(source, 0, source.length, true))
  assert.ok('error' in formatProductLine('\n文字', 0, 0, true))
})
