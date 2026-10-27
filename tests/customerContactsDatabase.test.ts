import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

/** migrations/customer_contacts.sql：手機格式檢查、公開金鑰讀不到 */
let db: PGlite
before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  `)
  const sql = (await readFile(new URL('../migrations/customer_contacts.sql', import.meta.url), 'utf8')).replace(/NOTIFY pgrst[^;]*;/, '')
  await db.exec(sql)
  await db.exec(sql)   // 可重複執行
})

test('記錄聯繫，手機格式不對擋下', async () => {
  await db.query(`INSERT INTO customer_contacts (phone, list_key, admin_name) VALUES ('0912345678', 'due', '小莊')`)
  await assert.rejects(db.query(`INSERT INTO customer_contacts (phone) VALUES ('02-1234')`))
  const r = (await db.query<any>('SELECT list_key, contacted_at IS NOT NULL AS has_time FROM customer_contacts')).rows[0]
  assert.deepEqual(r, { list_key: 'due', has_time: true })
})

test('公開金鑰讀不到', async () => {
  await db.exec('SET ROLE anon')
  try { await assert.rejects(db.query('SELECT * FROM customer_contacts'), /permission denied/) } finally { await db.exec('RESET ROLE') }
})
