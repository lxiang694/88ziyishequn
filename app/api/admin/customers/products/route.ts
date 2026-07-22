import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

const FETCH_BATCH = 1000
const MAX_BATCHES = 200
const MIN_BUYERS = 2 // 至少這麼多人買過才納入回購率排行，避免小樣本失真

function nameStr(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return v['zh-TW'] || v['zh'] || v.name || Object.values(v)[0] || ''
  return String(v)
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  const canView = admin.permissions.includes('all') ||
    admin.permissions.includes('orders.view') ||
    admin.role_key === 'customer_service'
  if (!canView) {
    return NextResponse.json({ success: false, error: '無權限查看客戶分析' }, { status: 403 })
  }

  // 1. 非取消訂單：order_id → { phone, time }
  const orderMap = new Map<number, { phone: string; time: number }>()
  for (let i = 0; i < MAX_BATCHES; i++) {
    const from = i * FETCH_BATCH
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, phone, created_at')
      .neq('order_status', '已取消')
      .not('phone', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + FETCH_BATCH - 1)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    const rows = data || []
    for (const o of rows) {
      const phone = (o.phone || '').trim()
      if (phone) orderMap.set(o.id, { phone, time: new Date(o.created_at).getTime() })
    }
    if (rows.length < FETCH_BATCH) break
  }

  // 2. 訂單品項：order_id, product_id, name
  type Item = { order_id: number; product_id: number; name: string }
  const items: Item[] = []
  const productName = new Map<number, string>()
  for (let i = 0; i < MAX_BATCHES; i++) {
    const from = i * FETCH_BATCH
    const { data, error } = await supabaseAdmin
      .from('order_items')
      .select('order_id, product_id, product_name_snapshot')
      .order('id', { ascending: true })
      .range(from, from + FETCH_BATCH - 1)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    const rows = data || []
    for (const it of rows) {
      if (!orderMap.has(it.order_id) || it.product_id == null) continue
      const nm = nameStr(it.product_name_snapshot)
      if (nm && !productName.has(it.product_id)) productName.set(it.product_id, nm)
      items.push({ order_id: it.order_id, product_id: it.product_id, name: nm })
    }
    if (rows.length < FETCH_BATCH) break
  }

  // 3. 每位客戶的訂單時間序 + 每張訂單的商品集合
  const orderProducts = new Map<number, Set<number>>() // order_id → product set
  for (const it of items) {
    let s = orderProducts.get(it.order_id)
    if (!s) { s = new Set(); orderProducts.set(it.order_id, s) }
    s.add(it.product_id)
  }
  const customerOrders = new Map<string, { id: number; time: number }[]>()
  for (const [id, o] of orderMap) {
    let arr = customerOrders.get(o.phone)
    if (!arr) { arr = []; customerOrders.set(o.phone, arr) }
    arr.push({ id, time: o.time })
  }

  // 4a. 商品回購率：同一客戶在 ≥2 張訂單買過同一商品
  const productBuyers = new Map<number, Map<string, Set<number>>>() // product → phone → orderIds
  for (const it of items) {
    const o = orderMap.get(it.order_id)!
    let byPhone = productBuyers.get(it.product_id)
    if (!byPhone) { byPhone = new Map(); productBuyers.set(it.product_id, byPhone) }
    let orders = byPhone.get(o.phone)
    if (!orders) { orders = new Set(); byPhone.set(o.phone, orders) }
    orders.add(it.order_id)
  }
  const repurchaseRanking = Array.from(productBuyers.entries()).map(([pid, byPhone]) => {
    let repeat = 0
    for (const orders of byPhone.values()) if (orders.size >= 2) repeat++
    const buyers = byPhone.size
    return {
      product_id: pid,
      name: productName.get(pid) || `#${pid}`,
      buyers,
      repeat_buyers: repeat,
      repurchase_rate: buyers > 0 ? Math.round((repeat / buyers) * 1000) / 10 : 0,
    }
  }).filter(p => p.buyers >= MIN_BUYERS)
    .sort((a, b) => b.repurchase_rate - a.repurchase_rate || b.buyers - a.buyers)
    .slice(0, 5)

  // 4b. 首購後最常回購的「新商品」（老客回頭時加購、且非首單就買過的品項）
  const nextProduct = new Map<number, Set<string>>() // product → phones
  for (const [phone, arr] of customerOrders) {
    if (arr.length < 2) continue
    arr.sort((a, b) => a.time - b.time)
    const firstSet = orderProducts.get(arr[0].id) || new Set<number>()
    const laterNew = new Set<number>()
    for (let i = 1; i < arr.length; i++) {
      const ps = orderProducts.get(arr[i].id)
      if (!ps) continue
      for (const pid of ps) if (!firstSet.has(pid)) laterNew.add(pid)
    }
    for (const pid of laterNew) {
      let s = nextProduct.get(pid)
      if (!s) { s = new Set(); nextProduct.set(pid, s) }
      s.add(phone)
    }
  }
  const nextRanking = Array.from(nextProduct.entries()).map(([pid, phones]) => ({
    product_id: pid,
    name: productName.get(pid) || `#${pid}`,
    customers: phones.size,
  })).sort((a, b) => b.customers - a.customers).slice(0, 5)

  return NextResponse.json({
    success: true,
    data: { repurchase_ranking: repurchaseRanking, next_product_ranking: nextRanking },
  })
}
