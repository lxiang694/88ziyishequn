import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { signToken } from '../lib/auth.ts'

// 假資料庫：記下每一個刪除動作
let campaign: { slug: string; title: string; is_published: boolean } | null = null
let orderCount = 0
const deletes: string[] = []
const fakeDb = {
  from: (table: string) => {
    let isDelete = false
    const q: any = {
      select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q,
      insert: async () => ({ error: null }),
      delete: () => { isDelete = true; deletes.push(table); return q },
      maybeSingle: async () => ({ data: table === 'group_buy_campaigns' ? campaign : null, error: null }),
      then: (resolve: any) => resolve(isDelete ? { error: null } : { count: orderCount, data: [], error: null }),
    }
    return q
  },
}
// repo.ts 也會載入 supabaseStorefront，一起給假的
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: fakeDb, supabaseStorefront: fakeDb, supabase: fakeDb } })
const { DELETE } = await import('../app/api/admin/group-buy/[id]/route')

const req = (withOrders = false) => new NextRequest(`https://shop.example/api/admin/group-buy/5${withOrders ? '?with_orders=1' : ''}`, {
  method: 'DELETE',
  headers: { cookie: `admin_token=${signToken({ id: 1, name: '測試', account: 't', role_key: 't', permissions: ['group_buy.manage'] })}` },
})
const ctx = { params: { id: '5' } }

test('開啟中的團不能刪', async () => {
  campaign = { slug: 'a', title: '十月團', is_published: true }; orderCount = 0; deletes.length = 0
  const res = await DELETE(req(), ctx)
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /先關閉/)
  assert.deepEqual(deletes, [])
})

test('關閉且沒有訂單：直接刪', async () => {
  campaign = { slug: 'b', title: '蔬菜團', is_published: false }; orderCount = 0; deletes.length = 0
  const res = await DELETE(req(), ctx)
  assert.equal(res.status, 200)
  assert.deepEqual(deletes, ['group_buy_campaigns'])
})

test('關閉但有訂單：先回 409 要求確認，確認後連同訂單一起刪', async () => {
  campaign = { slug: 'c', title: '鱸魚精', is_published: false }; orderCount = 3; deletes.length = 0
  const first = await DELETE(req(), ctx)
  assert.equal(first.status, 409)
  assert.deepEqual(await first.json(), { success: false, needsConfirm: true, orderCount: 3, error: '這一檔有 3 筆訂單' })
  assert.deepEqual(deletes, [], '還沒確認前什麼都不能刪')

  const second = await DELETE(req(true), ctx)
  assert.equal(second.status, 200)
  assert.equal((await second.json()).deletedOrders, 3)
  assert.deepEqual(deletes, ['group_buy_orders', 'group_buy_campaigns'])
})

test('沒有權限不能刪', async () => {
  const res = await DELETE(new NextRequest('https://shop.example/api/admin/group-buy/5', { method: 'DELETE' }), ctx)
  assert.equal(res.status, 401)
})
