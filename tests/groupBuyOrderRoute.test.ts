import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

// 只開 7-11 常溫的檔期（資料庫會回傳整列，含新加的欄位）
let campaign: Record<string, unknown> = {
  slug: '2026-11', is_published: true,
  ship_711_enabled: false, ship_711_normal_enabled: true, ship_home_enabled: false,
  fee_711: 150, fee_711_normal: 0, fee_home: 230, free_shipping_threshold: null,
}
const rpcCalls: any[] = []
mock.module('../lib/supabase.ts', { namedExports: { supabaseAdmin: {
  from: () => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: campaign, error: null }) }
    return q
  },
  rpc: async (_name: string, args: any) => {
    rpcCalls.push(args)
    return { data: { order_no: args.p_order_no, subtotal: 7920, shipping_fee: 0, total_amount: 7920 }, error: null }
  },
} } })
const { POST } = await import('../app/api/group-buy/orders/route')

const order = (shipping_method: string) => new NextRequest('https://shop.example/api/group-buy/orders', {
  method: 'POST',
  body: JSON.stringify({
    slug: '2026-11', customer_name: '王小明', phone: '0912345678', shipping_method,
    store_id: 1234, items: [{ item_id: 1, quantity: 4 }],
  }),
})

test('只開 7-11 常溫的檔期可以下單，門市會一起送進資料庫', async () => {
  // 曾經的錯誤：API 只讀了冷凍與宅配的開關，常溫被當成沒開放 →「請選擇取貨方式」
  const res = await POST(order('711_normal'))
  assert.equal(res.status, 200, await res.clone().text())
  assert.equal(rpcCalls.at(-1).p_shipping_method, '711_normal')
  assert.equal(rpcCalls.at(-1).p_store_id, 1234)
  assert.equal(rpcCalls.at(-1).p_home_address, null)
})

test('沒開放的取貨方式仍然擋下，不呼叫資料庫', async () => {
  const before = rpcCalls.length
  const res = await POST(order('711'))
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /取貨方式/)
  assert.equal(rpcCalls.length, before)
})
