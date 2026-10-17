import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDateTime } from '../lib/utils.ts'

test('訂單時間一律台灣時間 24 小時制', () => {
  assert.equal(formatDateTime('2026-10-16T09:47:00Z'), '2026/10/16 17:47')   // 下午 → 17:47
  assert.equal(formatDateTime('2026-10-16T12:00:00Z'), '2026/10/16 20:00')   // 晚上
  assert.equal(formatDateTime('2026-10-16T17:05:00Z'), '2026/10/17 01:05')   // 凌晨，跨日
  assert.equal(formatDateTime('2026-10-17T01:00:00Z'), '2026/10/17 09:00')   // 上午
  assert.equal(formatDateTime('2026-10-16T16:00:00Z'), '2026/10/17 00:00')   // 午夜
})

test('壞掉的時間字串原樣傳回，不會顯示 Invalid Date', () => {
  assert.equal(formatDateTime('not a date'), 'not a date')
})
