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
function request(permissions?: string[]) {
  const headers = new Headers()
  if (permissions) headers.set('cookie', `admin_token=${signToken({ id: 1, name: '測試', account: 'test', role_key: 'test', permissions })}`)
  return new NextRequest('https://shop.example/api/admin/myship/eligibility', { headers })
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
