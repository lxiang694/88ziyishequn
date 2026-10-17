import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

/**
 * migrations/security_lockdown_public.sql：模擬 Supabase 的預設權限
 * （anon／authenticated 對 public 的表都有 ALL、RLS 被關掉），執行後驗證
 * 公開金鑰讀不到、改不了、呼叫不了函式，而伺服器用的 service_role 照常可用。
 */
let db: PGlite
before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_auth_admin;
    CREATE TABLE user_profiles (id int PRIMARY KEY, phone text);
    ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;           -- 舊遷移檔的寫法
    CREATE TABLE orders (id serial PRIMARY KEY, phone text, total int);
    CREATE VIEW product_sales AS SELECT 1 AS product_id, 3 AS sold;   -- view 不受 RLS 管
    CREATE FUNCTION place_order(p int) RETURNS int LANGUAGE sql AS 'SELECT p';
    INSERT INTO user_profiles VALUES (1, '0912345678');
    INSERT INTO orders (phone, total) VALUES ('0912345678', 650);
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
    -- Supabase 的預設：之後新建的表也自動給 anon
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  `)
  const sql = await readFile(new URL('../migrations/security_lockdown_public.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  await db.exec(sql)   // 可重複執行
})

const as = async (role: string, q: string) => {
  await db.exec(`SET ROLE ${role}`)
  try { return await db.query<any>(q) } finally { await db.exec('RESET ROLE') }
}
const denied = (role: string, q: string) =>
  assert.rejects(as(role, q), (e: any) => /permission denied/.test(e.message), `${role}: ${q}`)

test('公開金鑰（anon）與一般會員讀不到會員資料、訂單、統計 view', async () => {
  for (const role of ['anon', 'authenticated']) {
    await denied(role, 'SELECT * FROM user_profiles')
    await denied(role, 'SELECT * FROM orders')
    await denied(role, 'SELECT * FROM product_sales')
  }
})

test('公開金鑰改不了、刪不了資料，也不能直接呼叫下單函式', async () => {
  await denied('anon', `UPDATE user_profiles SET phone = 'x'`)
  await denied('anon', 'DELETE FROM orders')
  await denied('anon', `INSERT INTO orders (phone, total) VALUES ('x', 1)`)
  await denied('anon', 'SELECT place_order(1)')
})

test('伺服器（service_role）照常讀寫、可以呼叫函式', async () => {
  assert.equal((await as('service_role', 'SELECT phone FROM user_profiles')).rows[0].phone, '0912345678')
  assert.equal((await as('service_role', 'SELECT sold FROM product_sales')).rows[0].sold, 3)
  assert.equal((await as('service_role', 'SELECT place_order(7) AS r')).rows[0].r, 7)
  await as('service_role', `INSERT INTO orders (phone, total) VALUES ('0987654321', 100)`)
})

test('所有 public 資料表都開啟了 RLS；之後新建的表預設也不給 anon', async () => {
  const off = (await db.query<any>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`)).rows
  assert.deepEqual(off, [])
  await db.exec('CREATE TABLE later_table (id int)')
  await denied('anon', 'SELECT * FROM later_table')
})
