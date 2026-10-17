import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeGroupBuy, twTodayStart } from '../lib/groupBuy/dashboard.ts'

const now = new Date('2026-10-17T04:00:00Z')   // 台灣 12:00
const c = (id: number, o: Partial<{ starts: string; ends: string; pub: boolean }> = {}) => ({
  id, slug: `s${id}`, title: `團${id}`, is_published: o.pub ?? true,
  starts_at: o.starts ?? '2026-10-10T00:00:00Z', ends_at: o.ends ?? '2026-10-25T00:00:00Z',
})

test('台灣時間的今天 00:00', () => {
  assert.equal(twTodayStart(now).toISOString(), '2026-10-16T16:00:00.000Z')
  assert.equal(twTodayStart(new Date('2026-10-16T17:00:00Z')).toISOString(), '2026-10-16T16:00:00.000Z')   // 凌晨 1 點
})

test('只放需要注意的檔期：開團、預告、還有待出貨的；開團中排最前', () => {
  const campaigns = [
    c(1, { ends: '2026-10-01T00:00:00Z' }),                                  // 已截單、沒有待出貨 → 不放
    c(2, { ends: '2026-10-05T00:00:00Z' }),                                  // 已截單、還有待出貨 → 放
    c(3),                                                                     // 開團中
    c(4, { starts: '2026-11-01T00:00:00Z', ends: '2026-11-10T00:00:00Z' }),  // 預告
    c(5, { pub: false }),                                                     // 已關閉、沒有待出貨 → 不放
  ]
  const orders = [
    { campaign_id: 2, total_amount: 1000, status: '待出貨', created_at: '2026-10-04T00:00:00Z' },
    { campaign_id: 3, total_amount: 1980, status: '待出貨', created_at: '2026-10-17T01:00:00Z' },   // 今天
    { campaign_id: 3, total_amount: 1880, status: '已出貨', created_at: '2026-10-16T15:00:00Z' },   // 台灣昨天 23:00
    { campaign_id: 3, total_amount: 9999, status: '已取消', created_at: '2026-10-17T02:00:00Z' },   // 不算
  ]
  const s = summarizeGroupBuy(campaigns, orders, now)
  assert.deepEqual(s.campaigns.map(x => [x.id, x.phase]), [[3, 'open'], [4, 'upcoming'], [2, 'closed']])
  const open = s.campaigns[0]
  assert.deepEqual([open.orders, open.revenue, open.pending, open.today], [2, 3860, 1, 1])
  assert.equal(s.pendingTotal, 2)
  assert.equal(s.todayTotal, 1)
})
