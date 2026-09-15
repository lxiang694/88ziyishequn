import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { signToken } from '../lib/auth'
let data: { id: string }[] = [], error: any = null
const filters: unknown[][] = []
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: { from: (table: string) => {
  assert.equal(table, 'myship_transfers')
  const query = { select: (fields: string) => { assert.equal(fields, 'id'); return query }, eq: (...args: unknown[]) => { filters.push(args); return query }, limit: async (n: number) => { assert.equal(n, 1); return { data, error } } }
  return query
} } } })
const { GET } = await import('../app/api/admin/myship/eligibility/route')
function request(permissions?: string[], market: string | null = 'GM2601252733206') {
  const headers = new Headers()
  if (permissions) headers.set('cookie', `admin_token=${signToken({ id: 1, name: '測試', account: 'test', role_key: 'test', permissions })}`)
  const url = new URL('https://shop.example/api/admin/myship/eligibility')
  if (market !== null) url.searchParams.set('marketplace_id', market)
  return new NextRequest(url, { headers })
}
test('批次資格只讀取指定賣場已核對紀錄，拒絕未授權並且查詢失敗不算成功', async () => {
  assert.equal((await GET(request())).status, 401)
  assert.equal((await GET(request(['orders.view']))).status, 403)
  assert.equal(filters.length, 0)
  assert.deepEqual(await (await GET(request(['orders.transfer']))).json(), { pilot: false })
  data = [{ id: 'verified-transfer' }]
  assert.deepEqual(await (await GET(request(['orders.transfer']))).json(), { pilot: true })
  assert.deepEqual(filters.slice(-2), [['marketplace_id', 'GM2601252733206'], ['status', 'confirmed']])
  error = { message: 'private database detail' }
  const failed = await GET(request(['orders.transfer']))
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /private/)
})

test('資格一律按指定賣場查詢，缺少或格式錯誤的賣場代碼不查資料庫', async () => {
  // 原本這裡寫死 GM2601252733206，新增第二個賣場時會直接沿用第一個
  // 賣場的驗收結果，跳過單筆試轉。
  error = null; data = [{ id: 'verified-transfer' }]
  await GET(request(['orders.transfer'], 'GM2604107313905'))
  assert.deepEqual(filters.slice(-2), [['marketplace_id', 'GM2604107313905'], ['status', 'confirmed']])

  const before = filters.length
  for (const bad of [null, '', 'other', 'gm2604107313905', 'GM123', "GM1' or '1'='1"]) {
    assert.equal((await GET(request(['orders.transfer'], bad))).status, 400)
  }
  assert.equal(filters.length, before, '格式不合時不應該送出任何查詢')
})
