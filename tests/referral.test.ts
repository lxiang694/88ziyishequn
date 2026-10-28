import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateCode, normalizeCode, readStoredRef, referralOutcome, SHARE_TEMPLATES, withReferral } from '../lib/referral.ts'

test('推薦碼格式：6 碼、不含容易看錯的 0 O 1 I', () => {
  assert.equal(normalizeCode(' k7m2qx '), 'K7M2QX')
  for (const bad of ['K7M2Q', 'K7M2QX9', 'K0M2QX', 'KIM2QX', 'K7M-QX', null, 123]) assert.equal(normalizeCode(bad), null, String(bad))
  let i = 0
  const seq = [0, 0.1, 0.5, 0.99, 0.3, 0.7]
  const code = generateCode(() => seq[i++ % seq.length])
  assert.equal(normalizeCode(code), code)
})

test('分享連結只附上推薦碼（保持短），不動原有參數', () => {
  assert.equal(withReferral('https://www.88ziyishequn.com/shop', 'K7M2QX'), 'https://www.88ziyishequn.com/shop?ref=K7M2QX')
  assert.equal(withReferral('https://x.com/p?utm_source=line', 'K7M2QX', 'review'), 'https://x.com/p?utm_source=line&ref=K7M2QX')
  assert.equal(withReferral('https://x.com/p', null), 'https://x.com/p')
})

test('瀏覽器記的推薦碼 30 天有效', () => {
  const now = Date.now()
  assert.equal(readStoredRef(JSON.stringify({ code: 'K7M2QX', at: now - 86_400_000 }), now), 'K7M2QX')
  assert.equal(readStoredRef(JSON.stringify({ code: 'K7M2QX', at: now - 31 * 86_400_000 }), now), null)
  assert.equal(readStoredRef('壞掉的資料', now), null)
  assert.equal(readStoredRef(null, now), null)
})

test('推薦成效：訂單、營收、下單親友、第一次買的新客', () => {
  const orders = [
    { phone: '0911111111', order_no: 'TW1', created_at: '2026-10-01', total: 930, referral_code: 'AAAAAA' },
    { phone: '0911111111', order_no: 'TW2', created_at: '2026-10-20', total: 930, referral_code: 'AAAAAA' },
    { phone: '0922222222', order_no: 'TW3', created_at: '2026-10-10', total: 1430, referral_code: 'AAAAAA' },  // 老客
    { phone: '0933333333', order_no: 'GB1', created_at: '2026-10-11', total: 1280, referral_code: 'BBBBBB' },
  ]
  const first = new Map([['0911111111', 'TW1'], ['0922222222', 'TW0'], ['0933333333', 'GB1']])
  const r = referralOutcome(orders, first)
  assert.deepEqual(r.get('AAAAAA'), { orders: 3, revenue: 3290, buyers: 2, new_customers: 1 })
  assert.deepEqual(r.get('BBBBBB'), { orders: 1, revenue: 1280, buyers: 1, new_customers: 1 })
})

test('分享文案不出現療效字眼，且都帶連結', () => {
  for (const t of SHARE_TEMPLATES) {
    const text = t.text('https://x.com/?ref=K7M2QX')
    assert.match(text, /ref=K7M2QX/)
    assert.equal(/治療|治好|降血糖|改善.*病|療效/.test(text), false, t.key)
  }
})
