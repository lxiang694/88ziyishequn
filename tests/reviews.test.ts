import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskName, summarizeReviews, validateReview, reviewDate } from '../lib/reviews.ts'

test('名字遮蔽', () => {
  assert.equal(maskName('王小明'), '王*明')
  assert.equal(maskName('歐陽慧霞'), '歐**霞')
  assert.equal(maskName('王明'), '王*')
  assert.equal(maskName('王'), '王*')
  assert.equal(maskName('Jessica Lin'), 'J******n')
  assert.equal(maskName('', 'abc123@gmail.com'), 'a****3')
  assert.equal(maskName(null, null), '會員')
})

test('評分統計', () => {
  assert.deepEqual(summarizeReviews([]), { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, verified: 0 })
  const s = summarizeReviews([{ rating: 5, verified_purchase: true }, { rating: 5 }, { rating: 4 }, { rating: 2, verified_purchase: true }])
  assert.equal(s.count, 4)
  assert.equal(s.average, 4)
  assert.deepEqual(s.distribution, { 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 })
  assert.equal(s.verified, 2)
  assert.equal(summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }]).average, 4.3)
})

test('檢查評價內容', () => {
  assert.deepEqual(validateReview({ rating: 0, content: '好喝好喝好喝' }), { ok: false, error: '請選擇 1～5 顆星' })
  assert.deepEqual(validateReview({ rating: 5, content: ' 好 ' }), { ok: false, error: '評價內容至少 5 個字' })
  assert.equal((validateReview({ rating: 5, content: '字'.repeat(501) }) as any).error, '評價內容最多 500 個字')
  const ok = validateReview({ rating: '4', content: '  很好入口，\r\n\n\n\n家人也喜歡  ', tags: ['品質很好', '品質很好', '治好糖尿病', 3] })
  assert.deepEqual(ok, { ok: true, value: { rating: 4, content: '很好入口，\n\n家人也喜歡', tags: ['品質很好'] } })
})

test('評價日期用台灣時間', () => {
  assert.equal(reviewDate('2026-10-25T17:30:00Z'), '2026/10/26')
})
