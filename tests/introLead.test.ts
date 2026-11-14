import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitIntroLead } from '../lib/introLead.ts'

test('第一句當主句，其餘當補充', () => {
  const r = splitIntroLead('有機紫蘇籽油是一款植物油，主打天然、清爽。紫蘇籽本身含有豐富的 α-亞麻酸 ALA，適合日常補充。')
  assert.equal(r.lead, '有機紫蘇籽油是一款植物油，主打天然、清爽。')
  assert.equal(r.rest, '紫蘇籽本身含有豐富的 α-亞麻酸 ALA，適合日常補充。')
})

test('只有一句、或第一句太長：整段當主句', () => {
  assert.deepEqual(splitIntroLead('每天一顆，補充好油。'), { lead: '每天一顆，補充好油。', rest: '' })
  const long = '一'.repeat(70) + '。後面一句。'
  assert.deepEqual(splitIntroLead(long), { lead: long, rest: '' })
  assert.deepEqual(splitIntroLead(null), { lead: '', rest: '' })
})

test('有連字號的詞整個不換行', async () => {
  const { hyphenTokens } = await import('../lib/introLead.ts')
  assert.deepEqual(hyphenTokens('植物性 Omega-3 補充，α-亞麻酸 ALA'), [['植物性 ', false], ['Omega-3', true], [' 補充，', false], ['α-亞麻酸', true], [' ALA', false]])
})
