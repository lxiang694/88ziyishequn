import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('轉單交易：唯一保留、快照衝突、原子回寫、重試及權限', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE product_variants(id bigint PRIMARY KEY);
      CREATE TABLE orders(id bigint PRIMARY KEY,order_status text,total_amount integer,updated_at timestamptz DEFAULT now());
      CREATE TABLE order_items(id bigint PRIMARY KEY,order_id bigint REFERENCES orders(id),variant_id bigint,quantity integer);
      INSERT INTO product_variants VALUES(20);
      INSERT INTO orders(id,order_status,total_amount) VALUES(1,'待確認',1100),(2,'待確認',1100),(3,'待確認',1100),(4,'待確認',1100);
      INSERT INTO order_items VALUES(1,1,20,1),(2,2,20,1),(3,3,20,1),(4,4,20,1);`)
    await db.exec(await readFile(new URL('../migrations/myship_transfer.sql', import.meta.url), 'utf8'))
    await db.exec(`INSERT INTO myship_variant_mappings VALUES(20,'GM2601252733206')`)
    const snap = async (id: number) => (await db.query<{ s: unknown }>('SELECT myship_order_snapshot($1) s', [id])).rows[0].s
    const entries = async (ids: number[]) => Promise.all(ids.map(async id => ({ order_id: id, marketplace_id: 'GM2601252733206', snapshot: await snap(id), row: ['測試客','0900000000','001234','常溫','測試商品','1100','0','','',''] })))
    const reserve = async (id: string, data: unknown) => db.query('SELECT myship_reserve_batch($1,$2,$3)', [id, JSON.stringify(data), 1])
    const batch = '00000000-0000-4000-8000-000000000001'
    await reserve(batch, await entries([1]))
    await assert.rejects(reserve(batch, await entries([2])))
    assert.equal((await db.query('SELECT * FROM myship_transfers WHERE order_id=2')).rows.length, 0)
    assert.equal((await db.query<{ order_status: string }>('SELECT order_status FROM orders WHERE id=1')).rows[0].order_status, '待確認')
    await assert.rejects(reserve('00000000-0000-4000-8000-000000000002', await entries([1,2])))
    assert.equal((await db.query('SELECT * FROM myship_transfers WHERE order_id=2')).rows.length, 0)
    const transfer = (await db.query<{ id: string }>('SELECT id FROM myship_transfers WHERE order_id=1')).rows[0].id
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,NULL,1)', [transfer]))
    await db.query('SELECT myship_confirm_transfer($1,$2,1)', [transfer, 'CM2609080000001'])
    await db.query('SELECT myship_confirm_transfer($1,$2,1)', [transfer, 'CM2609080000001'])
    assert.equal((await db.query<{ order_status: string }>('SELECT order_status FROM orders WHERE id=1')).rows[0].order_status, '已出貨')
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [transfer, 'CM2609080000002']))
    const stale = await entries([2])
    await db.exec('UPDATE order_items SET quantity=2 WHERE order_id=2')
    await assert.rejects(reserve('00000000-0000-4000-8000-000000000003', stale))
    await reserve('00000000-0000-4000-8000-000000000004', await entries([3,4]))
    const third = (await db.query<{ id: string }>('SELECT id FROM myship_transfers WHERE order_id=3')).rows[0].id
    // 編號衝突不得先更新原訂單狀態。
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [third, 'CM2609080000001']))
    assert.equal((await db.query<{ order_status: string }>('SELECT order_status FROM orders WHERE id=3')).rows[0].order_status, '待確認')
    await db.exec("UPDATE orders SET order_status='已取消' WHERE id=3")
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [third, 'CM2609080000003']))
    const fourth = (await db.query<{ id: string }>('SELECT id FROM myship_transfers WHERE order_id=4')).rows[0].id
    await db.exec('UPDATE orders SET total_amount=1200 WHERE id=4')
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [fourth, 'CM2609080000004']))
    // 確定未成立才解除；保留歷史，修正後可重新匯出，但舊紀錄不能確認。
    await assert.rejects(db.query('SELECT myship_release_transfer($1,$2,1)', [transfer, '已成立不可解除']))
    await assert.rejects(db.query('SELECT myship_release_transfer($1,$2,1)', [fourth, '短']))
    await db.query('SELECT myship_release_transfer($1,$2,1)', [fourth, '未匯入，修正金額後重做'])
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [fourth, 'CM2609080000004']))
    await reserve('00000000-0000-4000-8000-000000000005', await entries([4]))
    assert.equal((await db.query('SELECT * FROM myship_transfers WHERE order_id=4')).rows.length, 2)
    const replacement = (await db.query<{ id: string }>("SELECT id FROM myship_transfers WHERE order_id=4 AND status='exported'")).rows[0].id
    await db.query('SELECT myship_confirm_transfer($1,$2,1)', [replacement, 'CM2609080000004'])
    assert.equal((await db.query<{ order_status: string }>('SELECT order_status FROM orders WHERE id=4')).rows[0].order_status, '已出貨')
    // 既有管理流程可刪除原訂單，轉單快照保留；不能再對不存在的訂單回寫。
    await db.exec('DELETE FROM order_items WHERE order_id=3; DELETE FROM orders WHERE id=3;')
    assert.equal((await db.query<{ order_id: number | null }>('SELECT order_id FROM myship_transfers WHERE id=$1', [third])).rows[0].order_id, null)
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [third, 'CM2609080000003']))
    await db.exec('SET ROLE anon')
    await assert.rejects(db.query('SELECT * FROM myship_transfers'))
    await assert.rejects(db.query('SELECT myship_order_snapshot(1)'))
    await assert.rejects(db.query('SELECT myship_confirm_transfer($1,$2,1)', [fourth, 'CM2609080000004']))
    await db.exec('RESET ROLE')
  } finally { await db.close() }
})
