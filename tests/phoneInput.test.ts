import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhoneInput, formatPhoneDisplay, phoneHint } from '../lib/phoneInput.ts'

test('各種貼上的格式都整理成 10 碼', () => {
  for (const raw of ['0912345678', '0912-345-678', '0912 345 678', '+886 912 345 678', '886-0912-345-678', '０９１２３４５６７８', '0912345678999']) {
    assert.equal(normalizePhoneInput(raw), '0912345678', raw)
  }
})

test('顯示分成 4-3-3，打到一半也分好', () => {
  assert.equal(formatPhoneDisplay('0912345678'), '0912 345 678')
  assert.equal(formatPhoneDisplay('09123'), '0912 3')
  assert.equal(formatPhoneDisplay(''), '')
})

test('輸入提示', () => {
  assert.equal(phoneHint('').tone, 'idle')
  assert.deepEqual(phoneHint('0912'), { tone: 'typing', text: '還差 6 碼' })
  assert.equal(phoneHint('0212345678').tone, 'error')
  assert.equal(phoneHint('912345678').tone, 'error')
  assert.equal(phoneHint('0912345678').tone, 'ok')
})
