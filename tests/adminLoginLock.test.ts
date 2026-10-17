import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { isLocked, lockedMessage, WRONG_PASSWORD_MESSAGE } from '../lib/adminLoginLock.ts'

test('鎖定判斷：時間還沒到才算鎖定；欄位不存在時當作沒鎖', () => {
  const now = new Date('2026-10-17T09:00:00Z')
  assert.equal(isLocked('2026-10-17T09:10:00Z', now), true)
  assert.equal(isLocked('2026-10-17T08:59:00Z', now), false)
  assert.equal(isLocked(null, now), false)
  assert.equal(isLocked(undefined, now), false)
})

test('鎖定訊息：台灣時間 24 小時制與剩幾分鐘', () => {
  assert.equal(lockedMessage('2026-10-17T09:47:00Z', new Date('2026-10-17T09:32:00Z')),
    '密碼連續輸錯 3 次，帳號已暫時鎖定。請於 17:47 後再試（約 15 分鐘）。')
  assert.match(WRONG_PASSWORD_MESSAGE, /3 次會鎖定 15 分鐘/)
})

let db: PGlite
const fail = async (account: string) =>
  (await db.query<any>(`SELECT * FROM admin_login_failed($1, 3, 15)`, [account])).rows[0]
before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE admin_users (id serial PRIMARY KEY, account text UNIQUE, password_hash text);
    INSERT INTO admin_users (account) VALUES ('admin'), ('cs01');
  `)
  const sql = await readFile(new URL('../migrations/admin_login_lockout.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  await db.exec(sql)   // 可重複執行
})

test('資料庫：錯 1、2 次只累計，第 3 次鎖 15 分鐘並歸零', async () => {
  assert.deepEqual(await fail('admin'), { failed_count: 1, locked_until: null })
  assert.deepEqual(await fail('admin'), { failed_count: 2, locked_until: null })
  const third = await fail('admin')
  assert.equal(third.failed_count, 0)
  const mins = (new Date(third.locked_until).getTime() - Date.now()) / 60_000
  assert.ok(mins > 14 && mins <= 15.1, `鎖定約 15 分鐘，實際 ${mins}`)
  // 另一個帳號不受影響
  assert.deepEqual(await fail('cs01'), { failed_count: 1, locked_until: null })
  // 不存在的帳號：沒有資料列，不會出錯
  assert.equal(await fail('nobody'), undefined)
})

test('資料庫：公開金鑰不能呼叫鎖定函式', async () => {
  await db.exec('SET ROLE anon')
  try {
    await assert.rejects(db.query(`SELECT * FROM admin_login_failed('admin', 3, 15)`), /permission denied/)
  } finally { await db.exec('RESET ROLE') }
})
