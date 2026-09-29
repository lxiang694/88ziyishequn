import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { prepareOrderParts, orderMarker, type TransferOrder } from '../lib/myship/domain.ts'
import { matchResultRows, type ResultTransfer } from '../lib/myship/results.ts'

// ═══════════════════════════════════════════════════════════
// 純邏輯：怎麼拆
// ═══════════════════════════════════════════════════════════

const X = { id: 'GM2601252733206', name: '小莊備用88', temperature: '常溫', enabled: true }
const Y = { id: 'GM2604107313905', name: '88自醫社群', temperature: '常溫', enabled: true }
const store = { id: 1, store_code: '001234', store_name: '新豐寶', address: '臺中市測試路1號', is_active: true }

/** 截圖裡那張訂單：兩個賣場的商品，總額 3030 */
function screenshotOrder(): TransferOrder {
  return {
    id: 1, order_no: 'TW20260928296474', customer_name: '陳碧玉', phone: '0912345678',
    store_id: 1, store_name: '新豐寶', store_address: '台中市測試路1號',
    order_status: '待確認', total_amount: 3030, created_at: '2026-09-28T10:00:00Z', updated_at: '2026-09-28T10:00:00Z', note: '',
    order_items: [
      { id: 11, variant_id: 43, product_name_snapshot: '6合一綜合維生素', variant_name_snapshot: '1瓶', sku_snapshot: 'A43', unit_price: 900, quantity: 2, subtotal: 1800 },
      { id: 12, variant_id: 24, product_name_snapshot: '薑黃素', variant_name_snapshot: '1瓶', sku_snapshot: 'A24', unit_price: 780, quantity: 1, subtotal: 780 },
      { id: 13, variant_id: 90, product_name_snapshot: '【小莊代購】維生素D3', variant_name_snapshot: '180顆', sku_snapshot: null, unit_price: 450, quantity: 1, subtotal: 450 },
    ],
  }
}
const mappings = [
  { variant_id: 43, marketplace_id: Y.id },
  { variant_id: 24, marketplace_id: Y.id },
  { variant_id: 90, marketplace_id: X.id },
]

describe('拆單：怎麼拆', () => {
  test('截圖那張訂單拆成兩張，各收各的', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    assert.equal(parts.length, 2)
    assert.deepEqual(parts.map(p => p.errors), [[], []])
    // 依商品第一次出現的順序：A43 在最前面，所以 Y 賣場是第 1 張
    assert.deepEqual(parts.map(p => [p.marketplace_id, p.part, p.parts, p.amount]), [
      [Y.id, 1, 2, 2580],   // 1800 + 780
      [X.id, 2, 2, 450],
    ])
  })

  test('兩張的代收金額加起來剛好等於原訂單總額 —— 不會重複代收', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    const collected = parts.reduce((sum, p) => sum + Number(p.row![5]), 0)
    assert.equal(collected, 3030)
    // 運費欄維持 0，沒有被加兩次
    assert.deepEqual(parts.map(p => p.row![6]), ['0', '0'])
  })

  test('每張只列自己賣場的商品', () => {
    const [first, second] = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    assert.match(first.row![4], /A43/)
    assert.match(first.row![4], /A24/)
    assert.doesNotMatch(first.row![4], /維生素D3/)
    assert.equal(second.row![4], '【小莊代購】維生素D3（180顆）×1')
  })

  test('原單標記加上序號，賣貨便後台看得出是同一張拆的', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    assert.deepEqual(parts.map(p => p.row![9]), [
      '健康優選訂單：TW20260928296474（1/2）',
      '健康優選訂單：TW20260928296474（2/2）',
    ])
  })

  test('沒拆單時標記跟以前一模一樣 —— 既有批次與結果檔不受影響', () => {
    assert.equal(orderMarker('TW1', 1, 1), '健康優選訂單：TW1')
    const single = { ...screenshotOrder(), total_amount: 450, order_items: [screenshotOrder().order_items[2]] }
    const [p] = prepareOrderParts(single, mappings, [X, Y], store)
    assert.equal(p.parts, 1)
    assert.equal(p.row![9], '健康優選訂單：TW20260928296474')
  })

  test('拆單序號每次算都一樣 —— 清單、建批次、比對結果三個時間點必須一致', () => {
    const a = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    // 賣場清單換個順序，序號不能跟著變
    const b = prepareOrderParts(screenshotOrder(), [...mappings].reverse(), [Y, X], store)
    assert.deepEqual(a.map(p => [p.marketplace_id, p.part]), b.map(p => [p.marketplace_id, p.part]))
  })

  test('拆完有一張低於賣貨便下限 55 元：整張都不匯出，而且說清楚是哪一張', () => {
    const o = screenshotOrder()
    o.order_items[2] = { ...o.order_items[2], unit_price: 40, subtotal: 40 }
    o.total_amount = 1800 + 780 + 40
    const parts = prepareOrderParts(o, mappings, [X, Y], store)
    // 只寄出一半、另一半永遠寄不出去，比整張卡住還難收拾
    assert.ok(parts.every(p => p.row === null))
    assert.ok(parts[0].errors.some(e => e.startsWith('第2張（小莊備用88）') && e.includes('55')))
  })

  test('其中一個賣場停用：整張都不匯出', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings, [X, { ...Y, enabled: false }], store)
    assert.ok(parts.every(p => p.row === null))
    assert.ok(parts[0].errors.some(e => e.includes('第1張') && e.includes('尚未啟用')))
  })

  test('有商品還沒設定賣場：不拆，整張回報，跟以前一樣', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings.slice(0, 2), [X, Y], store)
    assert.equal(parts.length, 1)
    assert.equal(parts[0].row, null)
    assert.ok(parts[0].errors.includes('尚有商品規格未設定賣場'))
  })

  test('總額與小計不一致時不拆 —— 那種訂單的代收金額本來就不可信', () => {
    const parts = prepareOrderParts({ ...screenshotOrder(), total_amount: 9999 }, mappings, [X, Y], store)
    assert.ok(parts.every(p => p.row === null))
    assert.ok(parts[0].errors.includes('訂單總額與商品小計不一致'))
  })
})

describe('拆單：結果檔比對', () => {
  test('拆單的序號標記可以被比對回去', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    // 第 1 張在自己的批次裡，跟第 2 張不同批次
    const transfer: ResultTransfer = { id: 't1', order_id: 1, import_row: parts[0].row!, status: 'exported', external_order_no: null }
    const result = matchResultRows([{ row: parts[0].row!, external_order_no: 'CM2609280000001', sheet_row: 2 }], [transfer])
    assert.deepEqual(result.confirmed, [{ transfer_id: 't1', order_no: 'TW20260928296474', external_order_no: 'CM2609280000001' }])
  })

  test('錯誤訊息指出是哪一半，拆單時才不會找錯張', () => {
    const parts = prepareOrderParts(screenshotOrder(), mappings, [X, Y], store)
    const transfer: ResultTransfer = { id: 't1', order_id: 1, import_row: parts[0].row!, status: 'exported', external_order_no: null }
    const tampered = [...parts[0].row!] as typeof parts[0]['row'] & string[]
    tampered[5] = '3030'   // 有人手動把代收改成全額
    assert.throws(
      () => matchResultRows([{ row: tampered as any, external_order_no: 'CM2609280000001', sheet_row: 2 }], [transfer]),
      /TW20260928296474（1\/2）：收件資料、商品或金額與原批次不符/,
    )
  })
})

// ═══════════════════════════════════════════════════════════
// 資料庫：真的跑一次 migration
// ═══════════════════════════════════════════════════════════

const MX = 'GM2601252733206'
const MY = 'GM2604107313905'
const row = (amount: number) => JSON.stringify(['', '', '', '', '', String(amount), '0', '', '', ''])

async function setup() {
  const db = new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE product_variants(id bigint PRIMARY KEY);
    CREATE TABLE orders(id bigint PRIMARY KEY, order_status text, total_amount integer, customer_name text, updated_at timestamptz DEFAULT now());
    CREATE TABLE order_items(id bigint PRIMARY KEY, order_id bigint REFERENCES orders(id), variant_id bigint, quantity integer, subtotal integer);
    INSERT INTO product_variants VALUES (1),(2),(3);`)
  for (const file of ['myship_transfer.sql', 'myship_confirm_recovery.sql', 'myship_split_orders.sql']) {
    await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'))
  }
  await db.exec(`INSERT INTO myship_marketplaces(id,name,enabled) VALUES ('${MY}','88自醫社群',true) ON CONFLICT DO NOTHING;
    INSERT INTO myship_variant_mappings VALUES (1,'${MX}'),(2,'${MY}'),(3,'${MX}');`)
  return db
}

/** 建一張訂單。items: [variant_id, subtotal][] */
async function makeOrder(db: PGlite, id: number, items: [number, number][]) {
  const total = items.reduce((s, [, sub]) => s + sub, 0)
  await db.query(`INSERT INTO orders VALUES ($1,'待確認',$2,'測試客',now())`, [id, total])
  for (const [n, [variant, subtotal]] of items.entries()) {
    await db.query(`INSERT INTO order_items VALUES ($1,$2,$3,1,$4)`, [id * 100 + n, id, variant, subtotal])
  }
}

let batchSeq = 0
async function reserve(db: PGlite, orderId: number, market: string, amount: number, part?: [number, number]) {
  const batch = `00000000-0000-4000-8000-${String(++batchSeq).padStart(12, '0')}`
  const snap = (await db.query<{ s: unknown }>('SELECT myship_order_snapshot($1) AS s', [orderId])).rows[0].s
  const entry: any = { order_id: orderId, marketplace_id: market, row: JSON.parse(row(amount)), snapshot: snap }
  if (part) { entry.part_no = part[0]; entry.part_count = part[1] }
  await db.query('SELECT myship_reserve_batch($1,$2,1)', [batch, JSON.stringify([entry])])
}

async function confirm(db: PGlite, orderId: number, market: string, cm: string) {
  await db.query(`SELECT myship_confirm_transfer(id,$3,1) FROM myship_transfers
    WHERE order_id=$1 AND marketplace_id=$2 AND status='exported'`, [orderId, market, cm])
}

const statusOf = async (db: PGlite, id: number) =>
  (await db.query<{ order_status: string }>('SELECT order_status FROM orders WHERE id=$1', [id])).rows[0].order_status

describe('拆單：資料庫', () => {
  test('完整流程：兩張分別匯出、分別確認，兩張都確認了訂單才算出貨', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])   // 一個 X、一個 Y

      await reserve(db, 1, MY, 2580, [1, 2])
      await reserve(db, 1, MX, 450, [2, 2])

      await confirm(db, 1, MY, 'CM2609280000001')
      // 關鍵：第一張確認後訂單仍是待確認。改成已出貨的話，轉單清單只抓
      // 待確認的訂單，另一張會從清單消失。
      assert.equal(await statusOf(db, 1), '待確認')

      await confirm(db, 1, MX, 'CM2609280000002')
      assert.equal(await statusOf(db, 1), '已出貨')
    } finally { await db.close() }
  })

  test('第二張可以晚一點才匯出：第一張確認後，訂單內容不變，第二張照樣能保留', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      await reserve(db, 1, MY, 2580, [1, 2])
      await confirm(db, 1, MY, 'CM2609280000001')
      // 第一張確認沒有動到訂單列，快照還是一樣，第二張的保留不會被擋
      await reserve(db, 1, MX, 450, [2, 2])
      await confirm(db, 1, MX, 'CM2609280000002')
      assert.equal(await statusOf(db, 1), '已出貨')
    } finally { await db.close() }
  })

  test('重複代收：拆單的一張填了全額，資料庫拒絕', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      await assert.rejects(reserve(db, 1, MY, 3030, [1, 2]), /代收金額與商品小計不符/)
      await assert.rejects(reserve(db, 1, MX, 3030, [2, 2]), /代收金額與商品小計不符/)
      assert.equal((await db.query('SELECT 1 FROM myship_transfers')).rows.length, 0)
    } finally { await db.close() }
  })

  test('少拆：跨兩個賣場的訂單宣稱不拆（1/1），資料庫拒絕', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      // 舊版助手不會帶拆單資訊，會被當成 1/1 —— 這種訂單一定要擋
      await assert.rejects(reserve(db, 1, MY, 2580), /商品賣場配對已改變/)
    } finally { await db.close() }
  })

  test('同一張不能重複匯出', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      await reserve(db, 1, MY, 2580, [1, 2])
      await assert.rejects(reserve(db, 1, MY, 2580, [1, 2]))
    } finally { await db.close() }
  })

  test('兩張不能搶同一個序號', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      await reserve(db, 1, MY, 2580, [1, 2])
      await assert.rejects(reserve(db, 1, MX, 450, [1, 2]))
    } finally { await db.close() }
  })

  test('原本整張匯出後改了配對：不能再多匯一張，否則那部分商品被收兩次錢', async () => {
    const db = await setup()
    try {
      // 兩個商品原本都在 X 賣場，整張匯出、代收全額
      await makeOrder(db, 1, [[1, 450], [3, 300]])
      await reserve(db, 1, MX, 750)
      // 之後有人把商品 3 改配到 Y 賣場，系統現在會想拆成兩張
      await db.exec(`UPDATE myship_variant_mappings SET marketplace_id='${MY}' WHERE variant_id=3`)
      await assert.rejects(reserve(db, 1, MY, 300, [2, 2]), /已有依不同拆單方式匯出的轉單/)
    } finally { await db.close() }
  })

  test('解除保留其中一張後可以重新匯出，兩張都確認後才出貨', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      await reserve(db, 1, MY, 2580, [1, 2])
      await reserve(db, 1, MX, 450, [2, 2])
      await confirm(db, 1, MY, 'CM2609280000001')

      await db.query(`SELECT myship_release_transfer(id,'賣貨便沒有成立這一張',1) FROM myship_transfers
        WHERE order_id=1 AND marketplace_id=$1`, [MX])
      assert.equal(await statusOf(db, 1), '待確認')

      await reserve(db, 1, MX, 450, [2, 2])
      await confirm(db, 1, MX, 'CM2609280000003')
      assert.equal(await statusOf(db, 1), '已出貨')
    } finally { await db.close() }
  })
})

describe('拆單：沒拆的訂單完全照舊', () => {
  test('單一賣場訂單不帶拆單資訊（舊版助手）也照樣能匯出、確認即出貨', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 2, [[1, 450], [3, 300]])
      await reserve(db, 2, MX, 750)
      const t = (await db.query<{ part_no: number; part_count: number }>('SELECT part_no,part_count FROM myship_transfers')).rows[0]
      assert.deepEqual(t, { part_no: 1, part_count: 1 })
      await confirm(db, 2, MX, 'CM2609280000009')
      assert.equal(await statusOf(db, 2), '已出貨')
    } finally { await db.close() }
  })

  test('單一賣場訂單的代收金額仍必須等於總額', async () => {
    const db = await setup()
    try {
      await makeOrder(db, 2, [[1, 450], [3, 300]])
      await assert.rejects(reserve(db, 2, MX, 700), /代收金額與商品小計不符/)
    } finally { await db.close() }
  })

  test('migration 可以重複執行', async () => {
    const db = await setup()
    try {
      await db.exec(await readFile(new URL('../migrations/myship_split_orders.sql', import.meta.url), 'utf8'))
      await makeOrder(db, 1, [[1, 450], [2, 2580]])
      await reserve(db, 1, MY, 2580, [1, 2])
    } finally { await db.close() }
  })
})
