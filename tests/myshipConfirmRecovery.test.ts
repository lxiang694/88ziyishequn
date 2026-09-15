import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { confirmError } from '@/lib/myship/confirmError'

test('已人工出貨可補記；不覆寫出貨時間，仍拒絕改單、取消、重號及越權', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE product_variants(id bigint PRIMARY KEY);
      CREATE TABLE orders(id bigint PRIMARY KEY,order_status text,total_amount integer,customer_name text,updated_at timestamptz DEFAULT now());
      CREATE TABLE order_items(id bigint PRIMARY KEY,order_id bigint REFERENCES orders(id),variant_id bigint,quantity integer);
      INSERT INTO product_variants VALUES(1);
      INSERT INTO orders SELECT n,'待確認',850,'測試客',now() FROM generate_series(1,7) n;
      INSERT INTO order_items SELECT n,n,1,1 FROM generate_series(1,7) n;`)
    for (const file of ['myship_transfer.sql', 'myship_confirm_recovery.sql']) await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'))
    await db.exec(`INSERT INTO myship_variant_mappings VALUES(1,'GM2601252733206');
      INSERT INTO myship_transfers(order_id,marketplace_id,batch_id,snapshot,import_row,created_by)
      SELECT id,'GM2601252733206','00000000-0000-4000-8000-000000000001',myship_order_snapshot(id),'["","","","","","","","","",""]',1 FROM orders;`)
    const confirm = (order: number, cm: string) => db.query('SELECT myship_confirm_transfer(id,$2,1) FROM myship_transfers WHERE order_id=$1', [order, cm])
    await db.exec("UPDATE orders SET order_status='已出貨',updated_at='2026-01-01' WHERE id=1")
    await confirm(1, 'CM2601010000001'); await confirm(1, 'CM2601010000001')
    const completed = (await db.query<{ status: string; external_order_no: string }>('SELECT status,external_order_no FROM myship_transfers WHERE order_id=1')).rows[0]
    assert.deepEqual(completed, { status: 'confirmed', external_order_no: 'CM2601010000001' })
    assert.equal((await db.query<{ unchanged: boolean }>("SELECT updated_at='2026-01-01'::timestamptz AS unchanged FROM orders WHERE id=1")).rows[0].unchanged, true)
    await assert.rejects(confirm(1, 'CM2601010000002'))
    await assert.rejects(confirm(2, 'CM2601010000001'))
    assert.equal((await db.query<{ order_status: string }>('SELECT order_status FROM orders WHERE id=2')).rows[0].order_status, '待確認')
    await db.exec("UPDATE orders SET order_status='已出貨', total_amount=999 WHERE id=3; UPDATE orders SET order_status='已取消' WHERE id=4; UPDATE order_items SET quantity=2 WHERE order_id=5; UPDATE orders SET order_status='已出貨',customer_name='另一位' WHERE id=6;")
    for (const id of [3,4,5,6]) await assert.rejects(confirm(id, `CM260101000000${id}`))
    assert.equal((await db.query("SELECT * FROM myship_transfers WHERE order_id IN (3,4,5,6) AND status<>'exported'")).rows.length, 0)
    await db.exec("UPDATE orders SET updated_at='2026-01-02' WHERE id=7")
    await confirm(7, 'CM2601010000007')
    await db.exec('SET ROLE anon'); await assert.rejects(confirm(2, 'CM2601010000002')); await db.exec('RESET ROLE')
  } finally { await db.close() }
})

test('核對錯誤分類清楚且不暴露未知資料庫內容', () => {
  assert.match(confirmError({ code: '23505' }), /已被其他轉單使用/)
  assert.match(confirmError({ message: '原訂單狀態已改變，請人工核對' }), /資料庫修正/)
  assert.match(confirmError({ message: '原訂單內容已改變，請人工核對' }), /繼續其他訂單/)
  assert.doesNotMatch(confirmError({ message: 'secret database details' }), /secret/)
})
