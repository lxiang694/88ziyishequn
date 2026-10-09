import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { buildSalesMap, getSalesCountForProduct } from '../lib/salesUtils.ts'

// ── 假的 Supabase 查詢：只實作 salesUtils 用到的方法，並照真的一樣每次最多回 1000 列 ──
type Row = Record<string, any>
function fakeDb(tables: Record<string, Row[] | Error>) {
  return {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = []
      let range: [number, number] = [0, 999]
      const q: any = {
        select: () => q,
        order: () => q,
        eq: (col: string, v: unknown) => { filters.push(r => r[col] === v); return q },
        neq: (col: string, v: unknown) => {
          const [rel, field] = col.split('.')
          filters.push(r => (field ? r[rel]?.[field] : r[col]) !== v)
          return q
        },
        range: (a: number, b: number) => { range = [a, b]; return q },
        then: (resolve: (x: any) => void) => {
          const t = tables[table]
          if (!t || t instanceof Error) return resolve({ data: null, error: { message: 'relation does not exist' } })
          const rows = t.filter(r => filters.every(f => f(r)))
          // Supabase 的上限：不管 range 開多大，一次最多 1000 列
          const end = Math.min(range[1], range[0] + 999)
          resolve({ data: rows.slice(range[0], end + 1), error: null })
        },
      }
      return q
    },
  } as any
}

// 2500 筆明細：商品 1 每筆 1 件、商品 2 每筆 2 件；每 10 筆有 1 筆是已取消的訂單
const items: Row[] = Array.from({ length: 2500 }, (_, i) => ({
  id: i + 1, product_id: i % 2 ? 2 : 1, quantity: i % 2 ? 2 : 1,
  orders: { order_status: i % 10 === 0 ? '已取消' : '已出貨' },
}))
// 直接從資料算答案，不手算：已取消的那幾筆剛好都落在商品 1
const expected: Record<number, number> = {}
for (const it of items) if (it.orders.order_status !== '已取消') expected[it.product_id] = (expected[it.product_id] || 0) + it.quantity

describe('商品銷量', () => {
  test('檢視還沒建立時，逐頁讀完所有明細，不會停在第 1000 筆', async () => {
    const db = fakeDb({ product_sales: new Error('missing'), order_items: items })
    assert.deepEqual(await buildSalesMap(db), expected)
    assert.equal(await getSalesCountForProduct(2, db), expected[2])
  })

  test('有檢視時直接用檢視的加總', async () => {
    const db = fakeDb({ product_sales: [{ product_id: 1, sold: '7' }, { product_id: 2, sold: 3 }], order_items: new Error('不該讀明細') })
    assert.deepEqual(await buildSalesMap(db), { 1: 7, 2: 3 })
    assert.equal(await getSalesCountForProduct(1, db), 7)
    assert.equal(await getSalesCountForProduct(99, db), 0)
  })

  test('檢視超過 1000 個商品也會讀完', async () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ product_id: i + 1, sold: 1 }))
    const map = await buildSalesMap(fakeDb({ product_sales: many }))
    assert.equal(Object.keys(map).length, 1500)
  })
})

describe('product_sales 檢視（實際跑 SQL）', () => {
  test('加總正確、排除已取消、超過一千筆也正確、只有伺服器能讀', async () => {
    const db = new PGlite()
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE orders (id serial PRIMARY KEY, order_status text);
      CREATE TABLE order_items (id serial PRIMARY KEY, order_id int REFERENCES orders(id), product_id int, quantity int);
      INSERT INTO orders (order_status) SELECT CASE WHEN g % 10 = 0 THEN '已取消' ELSE '已出貨' END FROM generate_series(1, 2500) g;
      INSERT INTO order_items (order_id, product_id, quantity)
        SELECT g, CASE WHEN g % 2 = 0 THEN 2 ELSE 1 END, CASE WHEN g % 2 = 0 THEN 2 ELSE 1 END FROM generate_series(1, 2500) g;
      INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, NULL, 5);
    `)
    const sql = await readFile(new URL('../migrations/product_sales_view.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql) // 可重複執行

    const rows = (await db.query<{ product_id: number; sold: string }>('SELECT product_id, sold FROM product_sales ORDER BY product_id')).rows
    // 第 g 筆訂單：g%10==0 取消。奇數 g → 商品 1（1 件），偶數 g → 商品 2（2 件）
    let p1 = 0, p2 = 0
    for (let g = 1; g <= 2500; g++) if (g % 10 !== 0) { if (g % 2) p1 += 1; else p2 += 2 }
    assert.deepEqual(rows.map(r => [r.product_id, Number(r.sold)]), [[1, p1], [2, p2]])

    const grants = (await db.query<{ grantee: string }>(
      `SELECT grantee FROM information_schema.role_table_grants WHERE table_name = 'product_sales' AND privilege_type = 'SELECT'`)).rows
    assert.ok(grants.some(g => g.grantee === 'service_role'))
    assert.ok(!grants.some(g => ['anon', 'authenticated', 'PUBLIC'].includes(g.grantee)))
  })
})
