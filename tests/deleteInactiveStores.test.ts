import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('批次刪除僅移除停用且未被訂單引用的門市，支援重試與重複遷移', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE stores_711(id bigint PRIMARY KEY, store_code text, store_name text, address text, is_active boolean);
      CREATE TABLE orders(id bigint PRIMARY KEY, store_id bigint);
      CREATE TABLE group_buy_orders(id bigint PRIMARY KEY, store_id bigint);
      INSERT INTO stores_711 VALUES (1,'100001','測試甲','測試地址',false), (2,'100002','測試乙','測試地址',true),
        (3,'100003','測試丙','測試地址',false), (4,'100004','測試丁','測試地址',false),
        (5,'200005','測試戊','其他地址',false);
      INSERT INTO orders VALUES (1,3); INSERT INTO group_buy_orders VALUES (1,4);`)
    const sql = await readFile(new URL('../migrations/delete_inactive_stores.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    const call = async (ids: number[], all = false, q = '') =>
      (await db.query<{ result: { deleted: number; skipped: number } }>(
        'SELECT delete_inactive_stores($1::bigint[], $2, $3) AS result', [ids, all, q])).rows[0].result
    assert.deepEqual(await call([1, 2, 3, 4]), { deleted: 1, skipped: 3 })
    assert.deepEqual(await call([1]), { deleted: 0, skipped: 1 })
    assert.deepEqual(await call([], true, '200'), { deleted: 1, skipped: 0 })
    assert.deepEqual(await call([], true), { deleted: 0, skipped: 2 })
    assert.equal((await db.query('SELECT * FROM orders')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM group_buy_orders')).rows.length, 1)
    assert.deepEqual((await db.query<{ id: number }>('SELECT id FROM stores_711 ORDER BY id')).rows.map(x => Number(x.id)), [2,3,4])
    await assert.rejects(call([]), /格式錯誤/)
    // 其他資料表的外鍵擋下刪除時，整批回滾。
    await db.exec(`INSERT INTO stores_711 VALUES (6,'300006','測試己','測試地址',false), (7,'300007','測試庚','測試地址',false);
      CREATE TABLE external_reference(store_id bigint REFERENCES stores_711(id));
      INSERT INTO external_reference VALUES (7);`)
    await assert.rejects(call([6, 7]))
    assert.equal((await db.query('SELECT id FROM stores_711 WHERE id IN (6,7)')).rows.length, 2)
    await db.exec('DROP TABLE external_reference')
    assert.deepEqual(await call([6, 7]), { deleted: 2, skipped: 0 })
    // 尚未安裝團購功能時，同樣能清理一般門市。
    await db.exec('DROP TABLE group_buy_orders')
    assert.deepEqual(await call([], true, '測試'), { deleted: 1, skipped: 1 })
    assert.equal((await db.query('SELECT * FROM orders')).rows.length, 1)
  } finally { await db.close() }
})
