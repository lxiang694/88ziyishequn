import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

/**
 * migrations/myship_group_buy.sql：團購訂單走賣貨便轉單。
 * 依序執行既有的轉單、拆單、團購遷移，再執行本檔兩次（可重複執行）。
 */
let db: PGlite
const sql = (name: string) => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')
const BATCH = () => crypto.randomUUID()
const one = async (q: string, p: unknown[] = []) => (await db.query<any>(q, p)).rows[0]

let gbFrozen = 0, gbNormal = 0, gbHome = 0
const row = (o: { name: string; phone: string; code: string; temp: string; total: number; no: string }) =>
  [o.name, o.phone, o.code, o.temp, '鱸魚精（6入）×1', String(o.total), '0', '2026/10/20', '', `健康優選團購：${o.no}`]
const reserve = (entries: unknown[], batch = BATCH()) =>
  db.query(`SELECT myship_reserve_group_buy_batch($1::uuid, $2::jsonb, 1)`, [batch, JSON.stringify(entries)])

before(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE stores_711 (id serial PRIMARY KEY, store_code text, store_name text, address text, is_active boolean DEFAULT true);
    INSERT INTO stores_711 (store_code, store_name, address, is_active) VALUES ('293116','湖慧','高雄市',true), ('900000','已關店','台北市',false);
    CREATE TABLE product_variants (id bigserial PRIMARY KEY);
    CREATE TABLE orders (id bigserial PRIMARY KEY, order_no text, order_status text, total_amount int, updated_at timestamptz DEFAULT now());
    CREATE TABLE order_items (id bigserial PRIMARY KEY, order_id bigint REFERENCES orders(id), variant_id bigint, subtotal int);
  `)
  for (const f of ['myship_transfer.sql', 'myship_split_orders.sql', 'group_buy_schema.sql', 'group_buy_711_normal.sql']) await db.exec(await sql(f))
  const mine = await sql('myship_group_buy.sql')
  await db.exec(mine); await db.exec(mine)

  await db.exec(`
    UPDATE myship_marketplaces SET temperature = '常溫';
    INSERT INTO myship_marketplaces (id, name, temperature, enabled) VALUES ('GM1000001', '冷凍賣場', '冷凍', true);
    INSERT INTO group_buy_campaigns (slug, title, starts_at, ends_at, ship_711_enabled, ship_711_normal_enabled, ship_home_enabled, is_published)
      VALUES ('2026-11', '鱸魚精團', now() - interval '1 day', now() + interval '5 days', true, true, true, true);
    INSERT INTO group_buy_items (campaign_id, name, spec, price) VALUES (1, '鱸魚精', '6入', 1280);
  `)
  const ins = async (no: string, method: string, store: number | null, home: string | null) => {
    const o = await one(`INSERT INTO group_buy_orders (order_no, campaign_id, customer_name, phone, shipping_method, store_id, store_code, store_name, store_address, home_address, subtotal, shipping_fee, total_amount)
      VALUES ($1, 1, '王小明', '0912345678', $2, $3, $4, $5, '高雄市', $6, 1280, 150, 1430) RETURNING id`,
      [no, method, store, store ? (store === 1 ? '293116' : '900000') : null, store ? '湖慧' : null, home])
    await db.query(`INSERT INTO group_buy_order_items (order_id, item_id, name_snapshot, spec_snapshot, unit_price, quantity, subtotal) VALUES ($1, 1, '鱸魚精', '6入', 1280, 1, 1280)`, [o.id])
    return o.id as number
  }
  gbFrozen = await ins('GB20261020000001', '711', 1, null)
  gbNormal = await ins('GB20261020000002', '711_normal', 1, null)
  gbHome = await ins('GB20261020000003', 'home', null, '台北市大安區建國南路一段28號')
})

const frozenRow = () => row({ name: '王小明', phone: '0912345678', code: '293116', temp: '冷凍', total: 1430, no: 'GB20261020000001' })

test('擋下：溫層不符、宅配、金額或門市被改、門市已關、非待出貨', async () => {
  await assert.rejects(reserve([{ group_buy_order_id: gbFrozen, marketplace_id: 'GM2601252733206', row: row({ name: '王小明', phone: '0912345678', code: '293116', temp: '冷凍', total: 1430, no: 'GB20261020000001' }) }]), /溫層不符/)
  await assert.rejects(reserve([{ group_buy_order_id: gbHome, marketplace_id: 'GM1000001', row: frozenRow() }]), /不是 7-11 取貨/)
  const cheap = frozenRow(); cheap[5] = '1'
  await assert.rejects(reserve([{ group_buy_order_id: gbFrozen, marketplace_id: 'GM1000001', row: cheap }]), /內容已改變/)
  const otherStore = frozenRow(); otherStore[2] = '111111'
  await assert.rejects(reserve([{ group_buy_order_id: gbFrozen, marketplace_id: 'GM1000001', row: otherStore }]), /內容已改變/)
  await db.query(`UPDATE group_buy_orders SET store_id = 2 WHERE id = $1`, [gbNormal])
  await assert.rejects(reserve([{ group_buy_order_id: gbNormal, marketplace_id: 'GM2601252733206', row: row({ name: '王小明', phone: '0912345678', code: '900000', temp: '常溫', total: 1430, no: 'GB20261020000002' }) }]), /門市不存在或已停用/)
  await db.query(`UPDATE group_buy_orders SET store_id = 1, status = '已取消' WHERE id = $1`, [gbNormal])
  await assert.rejects(reserve([{ group_buy_order_id: gbNormal, marketplace_id: 'GM2601252733206', row: row({ name: '王小明', phone: '0912345678', code: '293116', temp: '常溫', total: 1430, no: 'GB20261020000002' }) }]), /不是待出貨/)
  await db.query(`UPDATE group_buy_orders SET status = '待出貨' WHERE id = $1`, [gbNormal])
  assert.equal((await one(`SELECT count(*)::int AS n FROM myship_transfers`)).n, 0, '失敗時整批都不寫入')
})

test('成功保留；同一張不能重複匯出；冷凍與常溫不能混在同一批', async () => {
  await assert.rejects(reserve([
    { group_buy_order_id: gbFrozen, marketplace_id: 'GM1000001', row: frozenRow() },
    { group_buy_order_id: gbNormal, marketplace_id: 'GM2601252733206', row: row({ name: '王小明', phone: '0912345678', code: '293116', temp: '常溫', total: 1430, no: 'GB20261020000002' }) },
  ]), /同一個賣場/)
  await reserve([{ group_buy_order_id: gbFrozen, marketplace_id: 'GM1000001', row: frozenRow() }])
  const t = await one(`SELECT * FROM myship_transfers WHERE group_buy_order_id = $1`, [gbFrozen])
  assert.deepEqual([t.source, t.order_id, t.status, t.marketplace_id], ['group_buy', null, 'exported', 'GM1000001'])
  assert.equal(t.snapshot.order.total_amount, 1430)
  await assert.rejects(reserve([{ group_buy_order_id: gbFrozen, marketplace_id: 'GM1000001', row: frozenRow() }]), /已經匯出過/)
})

test('核對成功：團購訂單改成已出貨；改內部備註不影響，改收件內容會擋下', async () => {
  const t = await one(`SELECT id FROM myship_transfers WHERE group_buy_order_id = $1`, [gbFrozen])
  await db.query(`UPDATE group_buy_orders SET admin_note = '已電話確認', updated_at = now() WHERE id = $1`, [gbFrozen])
  await db.query(`SELECT myship_confirm_transfer($1::uuid, 'CM2610200000001', 1)`, [t.id])
  assert.equal((await one(`SELECT status FROM group_buy_orders WHERE id = $1`, [gbFrozen])).status, '已出貨')
  assert.equal((await one(`SELECT status FROM myship_transfers WHERE id = $1`, [t.id])).status, 'confirmed')
  await db.query(`SELECT myship_confirm_transfer($1::uuid, 'CM2610200000001', 1)`, [t.id])   // 同編號重送：冪等

  const normalRow = row({ name: '王小明', phone: '0912345678', code: '293116', temp: '常溫', total: 1430, no: 'GB20261020000002' })
  await reserve([{ group_buy_order_id: gbNormal, marketplace_id: 'GM2601252733206', row: normalRow }])
  const t2 = await one(`SELECT id FROM myship_transfers WHERE group_buy_order_id = $1`, [gbNormal])
  await db.query(`UPDATE group_buy_orders SET note = '改地址了' WHERE id = $1`, [gbNormal])
  await assert.rejects(db.query(`SELECT myship_confirm_transfer($1::uuid, 'CM2610200000002', 1)`, [t2.id]), /內容已改變/)
})

test('一般訂單的確認流程照舊', async () => {
  await db.exec(`
    INSERT INTO product_variants DEFAULT VALUES;
    INSERT INTO myship_variant_mappings (variant_id, marketplace_id) VALUES (1, 'GM2601252733206');
    INSERT INTO orders (order_no, order_status, total_amount) VALUES ('TW20261020123456', '待確認', 650);
    INSERT INTO order_items (order_id, variant_id, subtotal) VALUES (1, 1, 650);
  `)
  const snap = (await one(`SELECT myship_order_snapshot(1) AS s`)).s
  const shopRow = ['李阿姨', '0911000111', '293116', '常溫', '艾絨披肩×1', '650', '0', '2026/10/20', '', '健康優選訂單：TW20261020123456']
  await db.query(`SELECT myship_reserve_batch($1::uuid, $2::jsonb, 1)`, [BATCH(), JSON.stringify([{ order_id: 1, marketplace_id: 'GM2601252733206', snapshot: snap, row: shopRow, part_no: 1, part_count: 1 }])])
  const t = await one(`SELECT id, source FROM myship_transfers WHERE order_id = 1`)
  assert.equal(t.source, 'shop')
  await db.query(`SELECT myship_confirm_transfer($1::uuid, 'CM2610200000009', 1)`, [t.id])
  assert.equal((await one(`SELECT order_status FROM orders WHERE id = 1`)).order_status, '已出貨')
})

test('資料表限制：一筆轉單不能同時指向一般訂單與團購訂單；公開金鑰不能呼叫', async () => {
  await assert.rejects(db.query(`INSERT INTO myship_transfers (source, order_id, group_buy_order_id, marketplace_id, batch_id, snapshot, import_row, created_by)
    VALUES ('group_buy', 1, $1, 'GM1000001', gen_random_uuid(), '{}'::jsonb, '["","","","","","","","","",""]'::jsonb, 1)`, [gbHome]), /source_chk/)
  await db.exec('SET ROLE anon')
  try { await assert.rejects(db.query(`SELECT myship_group_buy_snapshot(1)`), /permission denied/) } finally { await db.exec('RESET ROLE') }
})
