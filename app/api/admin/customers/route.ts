import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

const FETCH_BATCH = 1000
const MAX_BATCHES = 100 // 安全上限（最多 10 萬筆非取消訂單）

const DAY_MS = 24 * 60 * 60 * 1000
const DORMANT_DAYS = 60
const LOST_DAYS = 180
const VIP_MIN_ORDERS = 3

type Segment = 'vip' | 'lost' | 'dormant' | 'repeat' | 'new'

const SEGMENT_LABEL: Record<Segment, string> = {
  vip: 'VIP',
  lost: '流失客',
  dormant: '沉睡客',
  repeat: '回頭客',
  new: '新客',
}

function classify(orderCount: number, daysSinceLast: number): Segment {
  if (orderCount >= VIP_MIN_ORDERS && daysSinceLast <= DORMANT_DAYS) return 'vip'
  if (daysSinceLast > LOST_DAYS) return 'lost'
  if (daysSinceLast > DORMANT_DAYS) return 'dormant'
  if (orderCount >= 2) return 'repeat'
  return 'new'
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  // Same access level as sales reports — customer spend/contact data is sensitive
  const canView = admin.permissions.includes('all') || admin.role_key === 'customer_service'
  if (!canView) {
    return NextResponse.json({ success: false, error: '無權限查看客戶分析' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim().toLowerCase()
  const segment = searchParams.get('segment') || ''
  const sort = searchParams.get('sort') || 'amount_desc'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '50')))

  // 1. Pull all non-cancelled orders (paginated fetch, since PostgREST caps at 1000/req)
  const orders: any[] = []
  for (let i = 0; i < MAX_BATCHES; i++) {
    const from = i * FETCH_BATCH
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('phone, customer_name, line_id, total_amount, created_at')
      .neq('order_status', '已取消')
      .not('phone', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + FETCH_BATCH - 1)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    const rows = data || []
    orders.push(...rows)
    if (rows.length < FETCH_BATCH) break
  }

  // 2. Aggregate by phone
  type Agg = {
    phone: string; customer_name: string; line_id: string
    order_count: number; total_amount: number
    first_order_at: string; last_order_at: string
  }
  const byPhone = new Map<string, Agg>()
  for (const o of orders) {
    const phone = (o.phone || '').trim()
    if (!phone) continue
    const amount = parseFloat(o.total_amount || 0)
    let agg = byPhone.get(phone)
    if (!agg) {
      agg = {
        phone, customer_name: o.customer_name || '', line_id: o.line_id || '',
        order_count: 0, total_amount: 0,
        first_order_at: o.created_at, last_order_at: o.created_at,
      }
      byPhone.set(phone, agg)
    }
    agg.order_count += 1
    agg.total_amount += amount
    // orders are fetched oldest -> newest, so the latest row overwrites name/line snapshot
    agg.customer_name = o.customer_name || agg.customer_name
    agg.line_id = o.line_id || agg.line_id
    agg.last_order_at = o.created_at
    if (o.created_at < agg.first_order_at) agg.first_order_at = o.created_at
  }

  const now = Date.now()
  let customers = Array.from(byPhone.values()).map(c => {
    const daysSinceLast = Math.floor((now - new Date(c.last_order_at).getTime()) / DAY_MS)
    const avgOrderValue = c.total_amount / c.order_count
    const avgRepurchaseDays = c.order_count >= 2
      ? Math.round((new Date(c.last_order_at).getTime() - new Date(c.first_order_at).getTime()) / DAY_MS / (c.order_count - 1))
      : null
    const seg = classify(c.order_count, daysSinceLast)
    return {
      phone: c.phone,
      customer_name: c.customer_name,
      line_id: c.line_id,
      order_count: c.order_count,
      total_amount: Math.round(c.total_amount),
      avg_order_value: Math.round(avgOrderValue),
      first_order_at: c.first_order_at,
      last_order_at: c.last_order_at,
      days_since_last_order: daysSinceLast,
      avg_repurchase_days: avgRepurchaseDays,
      segment: seg,
      segment_label: SEGMENT_LABEL[seg],
    }
  })

  // 3. Summary (computed on the FULL customer base, before search/segment filtering)
  const totalCustomers = customers.length
  const repeatCustomers = customers.filter(c => c.order_count >= 2).length
  const withLine = customers.filter(c => c.line_id).length
  const totalRevenue = customers.reduce((s, c) => s + c.total_amount, 0)
  const totalOrders = customers.reduce((s, c) => s + c.order_count, 0)
  const repurchaseCycles = customers.filter(c => c.avg_repurchase_days !== null).map(c => c.avg_repurchase_days as number)

  const summary = {
    total_customers: totalCustomers,
    repeat_customers: repeatCustomers,
    repurchase_rate: totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
    line_coverage_rate: totalCustomers > 0 ? Math.round((withLine / totalCustomers) * 1000) / 10 : 0,
    avg_order_value: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    avg_repurchase_days: repurchaseCycles.length > 0
      ? Math.round(repurchaseCycles.reduce((s, d) => s + d, 0) / repurchaseCycles.length)
      : null,
    total_revenue: Math.round(totalRevenue),
  }

  // 4. Filter (search / segment)
  if (search) {
    customers = customers.filter(c =>
      c.phone.includes(search) ||
      c.customer_name.toLowerCase().includes(search) ||
      c.line_id.toLowerCase().includes(search)
    )
  }
  if (segment) {
    customers = customers.filter(c => c.segment === segment)
  }

  // 5. Sort
  const sorters: Record<string, (a: any, b: any) => number> = {
    amount_desc: (a, b) => b.total_amount - a.total_amount,
    amount_asc: (a, b) => a.total_amount - b.total_amount,
    orders_desc: (a, b) => b.order_count - a.order_count,
    recent_desc: (a, b) => new Date(b.last_order_at).getTime() - new Date(a.last_order_at).getTime(),
    inactive_desc: (a, b) => b.days_since_last_order - a.days_since_last_order,
  }
  customers.sort(sorters[sort] || sorters.amount_desc)

  const filteredTotal = customers.length
  const offset = (page - 1) * limit
  const pageData = customers.slice(offset, offset + limit)

  return NextResponse.json({
    success: true,
    data: { summary, customers: pageData, total: filteredTotal, page, limit },
  })
}
