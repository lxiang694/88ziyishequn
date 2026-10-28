import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

/** migrations/referrals.sql：推薦碼唯一、格式檢查、新欄位、公開金鑰讀不到 */
let db: PGlite
const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${U1}'), ('${U2}');
    CREATE TABLE user_profiles (id uuid PRIMARY KEY, name text, phone text);
    CREATE TABLE orders (id serial PRIMARY KEY, order_no text, phone text);
    CREATE TABLE group_buy_orders (id serial PRIMARY KEY, order_no text, phone text);
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  `)
  const sql = (await readFile(new URL('../migrations/referrals.sql', import.meta.url), 'utf8')).replace(/NOTIFY pgrst[^;]*;/, '')
  await db.exec(sql)
  await db.exec(sql)   // 可重複執行
})

test('每位會員一組推薦碼，推薦碼不能重複、格式要對', async () => {
  await db.query(`INSERT INTO referral_codes (user_id, code) VALUES ($1, 'K7M2QX')`, [U1])
  await assert.rejects(db.query(`INSERT INTO referral_codes (user_id, code) VALUES ($1, 'K7M2QX')`, [U2]))
  await assert.rejects(db.query(`INSERT INTO referral_codes (user_id, code) VALUES ($1, 'k7m2qx')`, [U2]))
  await assert.rejects(db.query(`INSERT INTO referral_codes (user_id, code) VALUES ($1, 'ABC1EF')`, [U2]), /check/i)
})

test('訂單、團購訂單、會員都多了推薦欄位', async () => {
  await db.query(`INSERT INTO orders (order_no, phone, referral_code) VALUES ('TW1', '0911111111', 'K7M2QX')`)
  await db.query(`INSERT INTO group_buy_orders (order_no, phone, referral_code) VALUES ('GB1', '0922222222', 'K7M2QX')`)
  await db.query(`INSERT INTO user_profiles (id, referred_by) VALUES ($1, 'K7M2QX')`, [U2])
  await db.query(`INSERT INTO referral_visits (code, visitor_id) VALUES ('K7M2QX', 'v1')`)
  assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM orders WHERE referral_code = 'K7M2QX'`)).rows[0].n, 1)
})

test('公開金鑰讀不到推薦資料', async () => {
  for (const t of ['referral_codes', 'referral_visits']) {
    await db.exec('SET ROLE anon')
    try { await assert.rejects(db.query(`SELECT * FROM ${t}`), /permission denied/) } finally { await db.exec('RESET ROLE') }
  }
})
