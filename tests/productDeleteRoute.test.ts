import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { signToken } from '../lib/auth.ts'

// 假資料庫：記下刪除與更新動作
let orderCount = 0
let hasArchiveColumn = true
let deleteError: { code: string; message: string } | null = null
const actions: { table: string; op: string; patch?: any }[] = []
const fakeDb = {
  from: (table: string) => {
    let op = 'select'
    let cols = ''
    let patch: any
    const q: any = {
      select: (c: string) => { cols = c; return q },
      eq: () => q, in: () => q, limit: () => q,
      delete: () => { op = 'delete'; actions.push({ table, op }); return q },
      update: (p: any) => { op = 'update'; patch = p; actions.push({ table, op, patch }); return q },
      then: (resolve: any) => {
        if (op === 'delete') return resolve({ error: deleteError })
        if (op === 'update') return resolve({ error: null })
        if (table === 'products' && cols === 'archived_at') return resolve({ error: hasArchiveColumn ? null : { message: 'column does not exist' } })
        return resolve({ count: orderCount, data: [], error: null })
      },
    }
    return q
  },
}
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: fakeDb, supabaseStorefront: fakeDb, supabase: fakeDb } })
const { DELETE, PATCH } = await import('../app/api/admin/products/[id]/route')

const cookie = `admin_token=${signToken({ id: 1, name: '測試', account: 't', role_key: 't', permissions: ['products.all'] })}`
const req = (method = 'DELETE', body?: unknown) => new NextRequest('https://shop.example/api/admin/products/7', {
  method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
})
const ctx = { params: { id: '7' } }
const reset = (n: number, column = true, err: typeof deleteError = null) => {
  orderCount = n; hasArchiveColumn = column; deleteError = err; actions.length = 0
}

test('沒有訂單的商品：真的刪除', async () => {
  reset(0)
  const res = await DELETE(req(), ctx)
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.archived, false)
  assert.deepEqual(actions.map(a => a.op), ['delete'])
})

test('有訂單的商品：不刪，改為封存並下架', async () => {
  reset(4)
  const res = await DELETE(req(), ctx)
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.archived, true)
  assert.equal(body.orderCount, 4)
  assert.match(body.message, /4 筆訂單.*封存/)
  assert.deepEqual(actions.map(a => a.op), ['update'], '有訂單時不能下刪除指令')
  assert.equal(actions[0].patch.is_published, false)
  assert.ok(actions[0].patch.archived_at)
})

test('還沒執行 products_archive.sql：至少下架，並提示要執行', async () => {
  reset(2, false)
  const body = await (await DELETE(req(), ctx)).json()
  assert.equal(body.success, true)
  assert.equal(body.archived, false)
  assert.deepEqual(actions[0].patch, { is_published: false })
  assert.match(body.message, /products_archive\.sql/)
})

test('其他資料連著（外鍵錯誤）：一樣改封存，不顯示英文錯誤', async () => {
  reset(0, true, { code: '23503', message: 'violates foreign key constraint' })
  const body = await (await DELETE(req(), ctx)).json()
  assert.equal(body.success, true)
  assert.equal(body.archived, true)
  assert.deepEqual(actions.map(a => a.op), ['delete', 'update'])
})

test('還原封存的商品', async () => {
  reset(0)
  const res = await PATCH(req('PATCH', { action: 'restore' }), ctx)
  assert.equal(res.status, 200)
  assert.deepEqual(actions[0].patch, { archived_at: null })
})

test('沒有權限不能刪', async () => {
  reset(0)
  const res = await DELETE(new NextRequest('https://shop.example/api/admin/products/7', { method: 'DELETE' }), ctx)
  assert.equal(res.status, 401)
  assert.deepEqual(actions, [])
})
