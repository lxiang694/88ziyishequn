import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveVariants } from '../lib/productVariants.ts'

/** 假資料庫：product_variants 有 1（沒賣過）、2（有訂單）、3（保留） */
function fakeDb(opts: { ordered?: number[]; failInsert?: boolean; deleteError?: string } = {}) {
  const ordered = new Set(opts.ordered ?? [2])
  const ops: string[] = []
  const db = {
    from: (_table: string) => {
      let op = 'select', id: number | null = null, row: any = null
      const q: any = {
        select: () => q,
        eq: (col: string, v: number) => { if (col === 'id') id = v; return q },
        delete: () => { op = 'delete'; return q },
        update: (r: any) => { op = 'update'; row = r; return q },
        insert: (r: any) => { op = 'insert'; row = r; return q },
        then: (resolve: any) => {
          if (op === 'select') return resolve({ data: [{ id: 1, variant_name: '單盒' }, { id: 2, variant_name: '三盒組' }, { id: 3, variant_name: '一盒（4支）' }], error: null })
          ops.push(`${op}:${id ?? row?.variant_name}${op === 'update' && row && 'is_active' in row && Object.keys(row).length === 1 ? ':off' : ''}`)
          if (op === 'delete' && opts.deleteError) return resolve({ error: { code: opts.deleteError } })
          if (op === 'delete' && id !== null && ordered.has(id)) return resolve({ error: { code: '23503', message: 'violates foreign key' } })
          if (op === 'insert' && opts.failInsert) return resolve({ error: { code: 'XX' } })
          return resolve({ error: null })
        },
      }
      return q
    },
  }
  return { db, ops }
}
const keep = [{ id: 3, variant_name: '一盒（4支）', sale_price: '300', stock_qty: '10' }]

test('沒賣過的規格真的刪掉；有訂單的改成下架，並回報名稱', async () => {
  const { db, ops } = fakeDb()
  const r = await saveVariants(db, 7, keep)
  assert.deepEqual(r, { retired: ['三盒組'] })
  assert.deepEqual(ops, ['delete:1', 'delete:2', 'update:2:off', 'update:3'])
})

test('新增規格一起存；全部都沒賣過就沒有下架名單', async () => {
  const { db, ops } = fakeDb({ ordered: [] })
  const r = await saveVariants(db, 7, [...keep, { variant_name: '兩盒組', sale_price: 580 }])
  assert.deepEqual(r, { retired: [] })
  assert.deepEqual(ops, ['delete:1', 'delete:2', 'update:3', 'insert:兩盒組'])
})

test('其他錯誤要回報，不能假裝成功', async () => {
  assert.match((await saveVariants(fakeDb({ deleteError: '42501' }).db, 7, keep)).error!, /刪除規格「單盒」失敗/)
  assert.match((await saveVariants(fakeDb({ ordered: [], failInsert: true }).db, 7, [...keep, { variant_name: '兩盒組', sale_price: 580 }])).error!, /兩盒組/)
})
