import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

// 假資料庫：記下寫入，依資料表回傳設定好的資料
let existing: { id: number } | null = null
let purchased = true
const writes: { op: string; row: any }[] = []
const fakeDb = {
  auth: { getUser: async (token: string) => token === 'good' ? { data: { user: { id: 'u-1', email: 'mei@example.com' } }, error: null } : { data: { user: null }, error: new Error('bad') } },
  from: (table: string) => {
    let op = 'select'
    let row: any
    const q: any = {
      select: () => q, eq: () => q, neq: () => q, or: () => q, order: () => q, limit: () => q, range: () => q,
      insert: (r: any) => { op = 'insert'; row = r; writes.push({ op, row }); return q },
      update: (r: any) => { op = 'update'; row = r; writes.push({ op, row }); return q },
      maybeSingle: async () => {
        if (table === 'products') return { data: { id: 7 }, error: null }
        if (table === 'user_profiles') return { data: { name: '王小明', phone: '0912345678' }, error: null }
        if (table === 'product_reviews') return { data: existing, error: null }
        return { data: null, error: null }
      },
      then: (resolve: any) => {
        if (op !== 'select') return resolve({ error: null })
        if (table === 'orders') return resolve({ data: purchased ? [{ id: 1, order_items: [{ product_id: 7, variant_name_snapshot: '1瓶（150顆）' }] }] : [], error: null })
        return resolve({ data: [], error: null })
      },
    }
    return q
  },
}
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: fakeDb, supabaseStorefront: fakeDb, supabase: fakeDb } })
const { POST } = await import('../app/api/reviews/route')

const post = (body: unknown, token = 'good') => POST(new NextRequest('https://shop.example/api/reviews', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
}))

test('沒登入不能寫評價', async () => {
  const res = await post({ product_id: 7, rating: 5, content: '很好入口很好入口' }, '')
  assert.equal(res.status, 401)
})

test('內容不合格擋下來', async () => {
  const res = await post({ product_id: 7, rating: 5, content: '好' })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /至少 5 個字/)
})

test('第一次寫：新增，名字遮蔽，買過的標「已購買」與規格', async () => {
  existing = null; purchased = true; writes.length = 0
  const res = await post({ product_id: 7, rating: 5, content: '吃了一個月，家人也喜歡', tags: ['會再回購'] })
  assert.equal(res.status, 200)
  assert.equal(writes[0].op, 'insert')
  const row = writes[0].row
  assert.equal(row.display_name, '王*明')
  assert.equal(row.verified_purchase, true)
  assert.equal(row.variant_name, '1瓶（150顆）')
  assert.equal(row.user_id, 'u-1')
  assert.deepEqual(row.tags, ['會再回購'])
})

test('已經寫過：改成更新，不能新增第二則；沒買過不標已購買', async () => {
  existing = { id: 3 }; purchased = false; writes.length = 0
  const res = await post({ product_id: 7, rating: 4, content: '更新一下心得內容' })
  assert.equal((await res.json()).updated, true)
  assert.equal(writes[0].op, 'update')
  assert.equal(writes[0].row.verified_purchase, false)
  assert.equal(writes[0].row.user_id, undefined, '更新不能改作者')
})
