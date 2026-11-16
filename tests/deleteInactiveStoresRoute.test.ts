import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'

let allowed = true
let rpcError: { code: string } | null = null
const calls: unknown[] = []
mock.module('../lib/adminMiddleware.ts', { namedExports: {
  requirePermission: (_req: unknown, permission: string) => {
    assert.equal(permission, 'orders.transfer')
    return allowed ? { admin: {} } : NextResponse.json({}, { status: 403 })
  },
} })
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: {
  rpc: async (name: string, params: unknown) => {
    assert.equal(name, 'delete_inactive_stores'); calls.push(params)
    return { data: { deleted: 2, skipped: 1 }, error: rpcError }
  },
} } })
mock.module('../lib/audit.ts', { namedExports: { writeAuditLog: async () => {} } })
const { DELETE } = await import('../app/api/admin/stores/route')
const send = (body: unknown, origin = 'https://shop.example') => DELETE(new NextRequest('https://shop.example/api/admin/stores', {
  method: 'DELETE', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body),
}))

test('批次刪除驗證權限、來源、選取、SQL 就緒與實際結果', async () => {
  allowed = false
  assert.equal((await send({ confirmed: true, ids: [1] })).status, 403)
  allowed = true
  assert.equal((await send({ confirmed: true, ids: [1] }, 'https://other.example')).status, 403)
  for (const body of [{ ids: [1] }, { confirmed: true, ids: [] }, { confirmed: true, ids: ['1'] },
    { confirmed: true, all: true, ids: [1], q: '' }, { confirmed: true, all: true }]) {
    assert.equal((await send(body)).status, 400)
  }
  assert.equal(calls.length, 0)
  rpcError = { code: 'PGRST202' }
  assert.equal((await send({ confirmed: true, ids: [1] })).status, 503)
  rpcError = null
  const res = await send({ confirmed: true, all: true, q: '測試,(*)' })
  assert.deepEqual(await res.json(), { success: true, deleted: 2, skipped: 1 })
  assert.deepEqual(calls.at(-1), { p_ids: [], p_all: true, p_q: '測試' })
  await send({ confirmed: true, ids: [1, 1, 2] })
  assert.deepEqual(calls.at(-1), { p_ids: [1, 2], p_all: false, p_q: '' })
})
