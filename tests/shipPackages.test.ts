import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { packageEta, packagesMessage, packageTitle, splitPackages, type ShipGroups } from '../lib/shipPackages.ts'

const item = (variant_id: number, name: string, subtotal: number, quantity = 1) => ({ variant_id, name, quantity, subtotal })
// 規格 1、2 走小莊備用88（現貨，代號 0）；規格 3 走 88好康（預購，代號 1）
const groups: ShipGroups = { 1: { group: 0, kind: '現貨' }, 2: { group: 0, kind: '現貨' }, 3: { group: 1, kind: '預購' } }

test('現貨＋預購：分兩包，現貨在前，各包金額加總等於訂單總額', () => {
  const p = splitPackages([item(3, '泡腳包', 400), item(1, '6合一綜合維生素', 950), item(2, '薑黃素', 780)], groups)!
  assert.equal(p.length, 2)
  assert.deepEqual(p.map(x => [x.kind, x.days, x.amount, x.items.map(i => i.name)]), [
    ['現貨', 3, 1730, ['6合一綜合維生素', '薑黃素']],
    ['預購', 7, 400, ['泡腳包']],
  ])
  assert.equal(p.reduce((s, x) => s + x.amount, 0), 2130)
  assert.equal(packageTitle(p[1], 1), '包裹 2・預購')
  assert.equal(packageEta(p[0]), '約 3 個工作日到店')
})

test('只有一包、或有商品沒配賣場：不提醒', () => {
  assert.equal(splitPackages([item(1, 'A', 100), item(2, 'B', 200)], groups), null)
  assert.equal(splitPackages([item(3, 'C', 100)], groups), null)
  assert.equal(splitPackages([item(1, 'A', 100), item(9, '沒配賣場', 200)], groups), null)
  assert.equal(splitPackages([item(1, 'A', 100), { variant_id: null, name: 'X', quantity: 1, subtotal: 1 }], groups), null)
})

test('賣場還沒標現貨／預購：照樣分包，只是不寫天數', () => {
  const p = splitPackages([item(1, 'A', 100), item(3, 'C', 200)], { 1: { group: 0, kind: null }, 3: { group: 1, kind: null } })!
  assert.equal(p.length, 2)
  assert.equal(packageEta(p[0]), '')
  assert.equal(packageTitle(p[0], 0), '包裹 1')
})

test('代客下單確認訊息：每包多久到、取貨付多少', () => {
  const p = splitPackages([item(1, '6合一綜合維生素 1瓶', 950), item(3, '泡腳包 1盒', 400)], groups)!
  const text = packagesMessage(p).join('\n')
  assert.match(text, /分 2 個包裹寄出/)
  assert.match(text, /現貨和預購分開寄/)
  assert.match(text, /【包裹 1・現貨】約 3 個工作日到店，取貨付 NT\$950\n・6合一綜合維生素 1瓶 ×1/)
  assert.match(text, /【包裹 2・預購】約 7 個工作日到店，取貨付 NT\$400\n・泡腳包 1盒 ×1/)
  assert.match(text, /不是寄錯/)
})

test('SQL：賣場標上現貨／預購，可重複執行，不接受其他值', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE myship_marketplaces(id text PRIMARY KEY, name text NOT NULL, temperature text NOT NULL DEFAULT '常溫', enabled boolean NOT NULL DEFAULT false);
      INSERT INTO myship_marketplaces(id,name,enabled) VALUES('GM2601252733206','小莊備用88',true),('GM2604107313905','88好康',true),('GM1111111','冷凍賣場',true);`)
    const sql = await readFile(new URL('../migrations/myship_ship_kind.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    const rows = (await db.query<{ id: string; ship_kind: string | null }>('SELECT id, ship_kind FROM myship_marketplaces ORDER BY id')).rows
    assert.deepEqual(rows.map(r => [r.id, r.ship_kind]), [['GM1111111', null], ['GM2601252733206', '現貨'], ['GM2604107313905', '預購']])
    await assert.rejects(db.exec("UPDATE myship_marketplaces SET ship_kind='其他' WHERE id='GM1111111'"))
  } finally {
    await db.close()
  }
})
