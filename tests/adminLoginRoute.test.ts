import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

const hash = bcrypt.hashSync('right-pass', 4)
let user: any
let rpcResult: any = [{ failed_count: 1, locked_until: null }]
const updates: any[] = []
const audits: any[] = []
const fakeDb = {
  from: (table: string) => {
    const q: any = {
      select: () => q, eq: () => q,
      single: async () => ({ data: table === 'admin_users' ? user : null, error: user ? null : { code: 'PGRST116' } }),
      update: (v: any) => { updates.push(v); return q },
      insert: async (v: any) => { audits.push(v); return { error: null } },
      then: (r: any) => r({ error: null }),
    }
    return q
  },
  rpc: async () => ({ data: rpcResult, error: null }),
}
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: fakeDb, supabaseStorefront: fakeDb, supabase: fakeDb } })
const { POST } = await import('../app/api/admin/auth/route')

const login = (password: string) => POST(new NextRequest('https://shop.example/api/admin/auth', {
  method: 'POST', body: JSON.stringify({ account: 'admin', password }),
}))
const base = { id: 1, name: '管理員', account: 'admin', password_hash: hash, admin_roles: { role_key: 'super_admin', role_name: '超級管理員', permissions_json: ['all'] } }

test('鎖定中：密碼正確也進不來', async () => {
  user = { ...base, failed_login_count: 0, locked_until: new Date(Date.now() + 10 * 60_000).toISOString() }
  const res = await login('right-pass')
  assert.equal(res.status, 423)
  assert.match((await res.json()).error, /已暫時鎖定/)
  assert.equal(res.headers.get('set-cookie'), null)
})

test('輸錯：一般錯誤訊息；第 3 次回鎖定訊息並記錄', async () => {
  user = { ...base, failed_login_count: 1, locked_until: null }
  rpcResult = [{ failed_count: 2, locked_until: null }]
  const second = await login('wrong')
  assert.equal(second.status, 401)
  assert.match((await second.json()).error, /3 次會鎖定 15 分鐘/)

  rpcResult = [{ failed_count: 0, locked_until: new Date(Date.now() + 15 * 60_000).toISOString() }]
  audits.length = 0
  const third = await login('wrong')
  assert.equal(third.status, 423)
  assert.match((await third.json()).error, /約 15 分鐘/)
  assert.equal(audits[0]?.action, 'admin.login_locked')
})

test('鎖定時間過了、密碼正確：可以登入，錯誤次數歸零', async () => {
  user = { ...base, failed_login_count: 2, locked_until: new Date(Date.now() - 60_000).toISOString() }
  updates.length = 0
  const res = await login('right-pass')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('set-cookie') || '', /admin_token=/)
  assert.deepEqual(updates[0], { failed_login_count: 0, locked_until: null })
})

test('資料庫還沒加欄位（舊資料）：照常登入，不會壞', async () => {
  user = { ...base }
  updates.length = 0
  assert.equal((await login('right-pass')).status, 200)
  assert.deepEqual(updates, [])
})
