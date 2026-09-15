import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { NextRequest } from 'next/server'
import { signToken } from '../lib/auth'
import { RESULT_HEADERS } from '../lib/myship/results'

const row = ['測試客','0900000000','001234','常溫','測試商品','1100','0','2026/09/09','','健康優選訂單：TW20260909000001']
const calls: string[] = []
const transfer = { id: '00000000-0000-4000-8000-000000000002', order_id: 1, import_row: row, status: 'exported', external_order_no: null }
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: {
  from: () => ({ select: () => ({ eq: async () => ({ data: [transfer], error: null }) }) }),
  rpc: async (_name: string, args: { p_external_order_no: string }) => { calls.push(args.p_external_order_no); return { error: null } },
} } })
mock.module('../lib/audit.ts', { namedExports: { writeAuditLog: async () => {} } })
const { POST } = await import('../app/api/admin/myship/results/route')
const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;')
function file(rows = [[...row, 'CM2609090000001']]) {
  return Buffer.from(zipSync({ 'xl/worksheets/sheet1.xml': strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[RESULT_HEADERS, ...rows].map((r, i) => `<row r="${i + 1}">${r.map((v, n) => `<c r="${String.fromCharCode(65 + n)}${i + 1}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`) }))
}
function request(body = file(), apply = true, permissions: string[] | null = ['orders.transfer'], origin = 'https://shop.example') {
  const headers = new Headers({ origin, 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  if (permissions) headers.set('cookie', `admin_token=${signToken({ id: 1, name: '測試管理員', account: 'test', role_key: 'test', permissions })}`)
  return new NextRequest(`https://shop.example/api/admin/myship/results?batch_id=00000000-0000-4000-8000-000000000001&apply=${apply}`, { method: 'POST', headers, body })
}
test('結果端點：權限、跨站、純預覽與整檔核對先於任何出貨回寫', async () => {
  assert.equal((await POST(request(file(), true, null))).status, 401)
  assert.equal((await POST(request(file(), true, ['orders.view']))).status, 403)
  assert.equal((await POST(request(file(), true, ['orders.transfer'], 'https://evil.example'))).status, 403)
  assert.equal((await POST(request(file(), false))).status, 200)
  assert.equal(calls.length, 0)
  // Valid first row followed by a foreign order must not partially write the valid row.
  const foreign = [...row]; foreign[9] = '健康優選訂單：TW20260909000002'
  assert.equal((await POST(request(file([[...row, 'CM2609090000001'], [...foreign, 'CM2609090000002']])))).status, 400)
  assert.equal(calls.length, 0)
  const applied = await POST(request())
  assert.equal(applied.status, 200)
  assert.deepEqual(await applied.json(), { confirmed: 1, unresolved: [], complete: true })
  assert.deepEqual(calls, ['CM2609090000001'])
})
