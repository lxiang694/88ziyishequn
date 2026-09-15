import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '../lib/auth'
import { authorize, readBody } from '../lib/myship/server'

const request = (permissions?: string[], origin = 'https://shop.example', method = 'POST') => {
  const headers = new Headers({ origin })
  if (permissions) headers.set('cookie', `admin_token=${signToken({ id: 1, name: '測試管理員', account: 'test', role_key: 'test', permissions })}`)
  return new NextRequest('https://shop.example/api/admin/myship/confirm', { method, headers })
}

test('轉單只允許有專屬權限的管理員，拒絕跨站寫入', () => {
  assert.equal((authorize(request()) as NextResponse).status, 401)
  assert.equal((authorize(request(['orders.view'])) as NextResponse).status, 403)
  assert.equal((authorize(request(['orders.transfer'], 'https://other.example')) as NextResponse).status, 403)
  assert.equal((authorize(request(['orders.transfer'], '')) as NextResponse).status, 403)
  assert.equal(authorize(request(['orders.transfer'])) instanceof NextResponse, false)
  assert.equal(authorize(request(['all'])) instanceof NextResponse, false)
  assert.equal(authorize(request(['orders.transfer'], '', 'GET')) instanceof NextResponse, false)
})

test('轉單拒絕超長或無效請求資料', async () => {
  const bodyRequest = (body: string) => new NextRequest('https://shop.example', { method: 'POST', body })
  await assert.rejects(readBody(bodyRequest('x'.repeat(50001))))
  await assert.rejects(readBody(bodyRequest('{')))
  assert.deepEqual(await readBody(bodyRequest('{"order_ids":[1]}')), { order_ids: [1] })
})
