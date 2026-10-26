import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

/** migrations/product_reviews.sql：一人一商品一則、欄位限制、公開金鑰讀不到 */
let db: PGlite
const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${U1}'), ('${U2}');
    CREATE TABLE products (id serial PRIMARY KEY, product_name text);
    INSERT INTO products (product_name) VALUES ('醣溜溜'), ('青蒿素');
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
  `)
  const sql = await readFile(new URL('../migrations/product_reviews.sql', import.meta.url), 'utf8')
  await db.exec(sql.replace(/NOTIFY pgrst[^;]*;/, ''))
  await db.exec(sql.replace(/NOTIFY pgrst[^;]*;/, ''))   // 可重複執行
})

const insert = (user: string, product: number, rating: number, content: string) => db.query(
  `INSERT INTO product_reviews (product_id, user_id, display_name, rating, content) VALUES ($1, $2, '王*明', $3, $4)`,
  [product, user, rating, content])

test('會員可以寫評價，預設公開', async () => {
  await insert(U1, 1, 5, '吃了一個月，很好入口')
  const r = (await db.query<any>('SELECT status, verified_purchase, tags FROM product_reviews WHERE user_id = $1', [U1])).rows[0]
  assert.equal(r.status, 'published')
  assert.equal(r.verified_purchase, false)
  assert.deepEqual(r.tags, [])
})

test('同一位會員對同一商品只能有一則（要改用更新）', async () => {
  await assert.rejects(insert(U1, 1, 4, '再寫一次看看'), /product_reviews_one_per_member/)
  await insert(U1, 2, 4, '另一個商品可以寫')
  await insert(U2, 1, 3, '別人也可以寫')
})

test('星數 1～5、內容 5～500 字', async () => {
  await assert.rejects(insert(U2, 2, 0, '零顆星不行'))
  await assert.rejects(insert(U2, 2, 6, '六顆星不行'))
  await assert.rejects(insert(U2, 2, 5, '太短'))
  await assert.rejects(insert(U2, 2, 5, '字'.repeat(501)))
})

test('商品刪除時評價跟著刪', async () => {
  await db.query('DELETE FROM products WHERE id = 2')
  const n = (await db.query<any>('SELECT count(*)::int AS n FROM product_reviews WHERE product_id = 2')).rows[0].n
  assert.equal(n, 0)
})

test('公開金鑰與一般登入讀寫不到，伺服器可以', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    try { await assert.rejects(db.query('SELECT * FROM product_reviews'), /permission denied/) } finally { await db.exec('RESET ROLE') }
  }
  await db.exec('SET ROLE service_role')
  try { assert.ok((await db.query('SELECT * FROM product_reviews')).rows.length >= 2) } finally { await db.exec('RESET ROLE') }
})
