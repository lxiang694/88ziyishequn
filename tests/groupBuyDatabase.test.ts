import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

/**
 * 團購下單函式：實際跑 SQL。
 * 金額、限量、限購都在資料庫裡檢查，這裡驗證每一道關卡都擋得住。
 */
let db: PGlite
const place = (o: Record<string, unknown> = {}) => {
  const a = {
    order_no: 'GB' + String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'),
    slug: '2026-11', name: '王小明', phone: '0912345678', method: '711', store: 1,
    address: null, time: null, note: '', items: [{ item_id: 1, quantity: 2 }], ...o,
  }
  return db.query<{ r: any }>(
    'SELECT place_group_buy_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) AS r',
    [a.order_no, a.slug, a.name, a.phone, a.method, a.store, a.address, a.time, a.note, JSON.stringify(a.items)],
  ).then(r => r.rows[0].r)
}
const rejects = async (o: Record<string, unknown>, msg: RegExp) => {
  await assert.rejects(place(o), (e: any) => msg.test(e.message), String(msg))
}

describe('團購下單（place_group_buy_order）', () => {
  before(async () => {
    db = new PGlite()
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE stores_711 (id serial PRIMARY KEY, store_code text, store_name text, address text, is_active boolean DEFAULT true);
      INSERT INTO stores_711 (store_code, store_name, address, is_active) VALUES
        ('293116', '湖慧', '高雄市湖內區中山路一段540-1號', true), ('900000', '已關店', '台北市', false);
    `)
    const sql = await readFile(new URL('../migrations/group_buy_schema.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql) // 可重複執行
    // 7-11 常溫取貨（後加的遷移，同樣可重複執行）
    const normal = await readFile(new URL('../migrations/group_buy_711_normal.sql', import.meta.url), 'utf8')
    await db.exec(normal)
    await db.exec(normal)
    await db.exec(`
      INSERT INTO group_buy_campaigns (slug, title, starts_at, ends_at, ship_711_enabled, ship_home_enabled, fee_711, fee_home, free_shipping_threshold, is_published)
      VALUES ('2026-11', '11 月團購', now() - interval '1 day', now() + interval '5 days', true, true, 150, 230, 3000, true),
             ('closed', '已截單', now() - interval '10 days', now() - interval '1 day', true, false, 0, 0, NULL, true),
             ('soon', '還沒開', now() + interval '1 day', now() + interval '5 days', true, false, 0, 0, NULL, true),
             ('draft', '草稿', now() - interval '1 day', now() + interval '5 days', true, false, 0, 0, NULL, false),
             ('711only', '只有超商', now() - interval '1 day', now() + interval '5 days', true, false, 0, 0, NULL, true);
      INSERT INTO group_buy_items (campaign_id, name, spec, price, original_price, per_person_limit, total_quota) VALUES
        (1, '鱸魚精', '6入', 1280, 1580, NULL, NULL),
        (1, '限量禮盒', '12入', 2400, NULL, NULL, 5),
        (1, '每人限 2', '單包', 100, NULL, 2, NULL),
        (2, '別檔商品', '', 500, NULL, NULL, NULL);
      INSERT INTO group_buy_items (campaign_id, name, price, is_active) VALUES (1, '已下架', 300, false);
    `)
    await db.exec(`UPDATE group_buy_campaigns SET ship_711_normal_enabled = true, fee_711_normal = 80 WHERE slug = '2026-11'`)
  })

  test('7-11 取貨：金額在資料庫算，門市資料快照下來', async () => {
    const r = await place({ items: [{ item_id: 1, quantity: 2 }] })
    assert.deepEqual([r.subtotal, r.shipping_fee, r.total_amount], [2560, 150, 2710])
    const o = (await db.query<any>(`SELECT * FROM group_buy_orders WHERE order_no = $1`, [r.order_no])).rows[0]
    assert.equal(o.store_code, '293116'); assert.equal(o.store_name, '湖慧'); assert.equal(o.status, '待出貨')
    const lines = (await db.query<any>(`SELECT name_snapshot, unit_price, quantity, subtotal FROM group_buy_order_items WHERE order_id = $1`, [o.id])).rows
    assert.deepEqual(lines, [{ name_snapshot: '鱸魚精', unit_price: 1280, quantity: 2, subtotal: 2560 }])
  })

  test('滿額免運；宅配用宅配運費、記錄地址與時段', async () => {
    const free = await place({ items: [{ item_id: 1, quantity: 3 }] })
    assert.equal(free.shipping_fee, 0)
    const home = await place({ method: 'home', store: null, address: '台北市大安區建國南路一段28號', time: '13點前' })
    assert.deepEqual([home.shipping_fee, home.total_amount], [230, 2790])
    const o = (await db.query<any>(`SELECT home_address, delivery_time, store_id FROM group_buy_orders WHERE order_no = $1`, [home.order_no])).rows[0]
    assert.deepEqual(o, { home_address: '台北市大安區建國南路一段28號', delivery_time: '13點前', store_id: null })
  })

  test('7-11 常溫取貨：自己的運費、要選門市、沒開放就擋下', async () => {
    const r = await place({ method: '711_normal', items: [{ item_id: 1, quantity: 1 }] })
    assert.deepEqual([r.shipping_fee, r.total_amount], [80, 1360])
    const o = (await db.query<any>(`SELECT shipping_method, store_code FROM group_buy_orders WHERE order_no = $1`, [r.order_no])).rows[0]
    assert.deepEqual(o, { shipping_method: '711_normal', store_code: '293116' })
    await rejects({ method: '711_normal', store: null }, /重新選擇 7-11 門市/)
    await rejects({ slug: '711only', method: '711_normal' }, /沒有開放 7-11 常溫/)
    // 資料庫層也擋：常溫取貨一定要有門市
    await assert.rejects(db.query(`INSERT INTO group_buy_orders (order_no, campaign_id, customer_name, phone, shipping_method, subtotal, shipping_fee, total_amount)
      VALUES ('GB20261101999999', 1, 'x', '0912345678', '711_normal', 100, 0, 100)`))
    // 三種都關掉不行
    await assert.rejects(db.query(`UPDATE group_buy_campaigns SET ship_711_enabled = false, ship_711_normal_enabled = false, ship_home_enabled = false WHERE slug = '711only'`))
  })

  test('時間與發布狀態：沒開始、已截單、草稿都不能下單', async () => {
    await rejects({ slug: 'closed', items: [{ item_id: 4, quantity: 1 }] }, /已截單/)
    await rejects({ slug: 'soon' }, /還沒開始/)
    await rejects({ slug: 'draft' }, /不存在/)
    await rejects({ slug: 'nope' }, /不存在/)
  })

  test('運送方式沒開放、門市關閉、宅配沒地址都擋下', async () => {
    await rejects({ slug: '711only', method: 'home', store: null, address: '台北市大安區某路1號' }, /沒有開放宅配/)
    await rejects({ store: 2 }, /重新選擇 7-11 門市/)
    await rejects({ store: 999 }, /重新選擇 7-11 門市/)
    await rejects({ method: 'home', store: null, address: '短' }, /完整的收件地址/)
    await rejects({ method: 'fly' }, /取貨方式/)
  })

  test('別檔的商品、已下架、重複、數量不對都擋下', async () => {
    await rejects({ items: [{ item_id: 4, quantity: 1 }] }, /已下架/)
    await rejects({ items: [{ item_id: 5, quantity: 1 }] }, /已下架/)
    await rejects({ items: [{ item_id: 1, quantity: 1 }, { item_id: 1, quantity: 2 }] }, /重複/)
    await rejects({ items: [{ item_id: 1, quantity: 0 }] }, /數量/)
    await rejects({ items: [] }, /至少選一樣/)
  })

  test('總量限量：賣完擋下，取消後釋出名額', async () => {
    const first = await place({ phone: '0911000001', items: [{ item_id: 2, quantity: 3 }] })
    await rejects({ phone: '0911000002', items: [{ item_id: 2, quantity: 3 }] }, /剩 2 件/)
    await db.query(`UPDATE group_buy_orders SET status = '已取消' WHERE order_no = $1`, [first.order_no])
    await place({ phone: '0911000002', items: [{ item_id: 2, quantity: 5 }] })
    await rejects({ phone: '0911000003', items: [{ item_id: 2, quantity: 1 }] }, /剩 0 件/)
  })

  test('每人限購：同一支手機跨訂單累計', async () => {
    await place({ phone: '0922000000', items: [{ item_id: 3, quantity: 1 }] })
    await rejects({ phone: '0922000000', items: [{ item_id: 3, quantity: 2 }] }, /每人限購 2 件（您已訂 1 件）/)
    await place({ phone: '0922000000', items: [{ item_id: 3, quantity: 1 }] })
    await place({ phone: '0933000000', items: [{ item_id: 3, quantity: 2 }] })  // 別人不受影響
  })

  test('一張單裡有一項不行，整張都不成立', async () => {
    const before = (await db.query<any>(`SELECT count(*)::int AS n FROM group_buy_orders`)).rows[0].n
    await rejects({ phone: '0944000000', items: [{ item_id: 1, quantity: 1 }, { item_id: 2, quantity: 1 }] }, /剩 0 件/)
    const after = (await db.query<any>(`SELECT count(*)::int AS n FROM group_buy_orders`)).rows[0].n
    assert.equal(after, before)
  })

  test('統計檢視不含已取消；權限只給伺服器', async () => {
    const stats = (await db.query<any>(`SELECT item_id, sold::int FROM group_buy_item_stats ORDER BY item_id`)).rows
    assert.equal(stats.find((s: any) => s.item_id === 2).sold, 5)
    const camp = (await db.query<any>(`SELECT buyers::int, orders::int FROM group_buy_campaign_stats WHERE campaign_id = 1`)).rows[0]
    assert.ok(camp.buyers >= 4 && camp.orders >= camp.buyers)
    const grants = (await db.query<any>(`SELECT DISTINCT grantee FROM information_schema.role_table_grants WHERE table_name LIKE 'group_buy%'`)).rows.map((r: any) => r.grantee)
    assert.ok(grants.includes('service_role'))
    assert.ok(!grants.some((g: string) => ['anon', 'authenticated', 'PUBLIC'].includes(g)))
  })
})
