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

// 計算某個時間點（refTime）當下的沉睡客戶數：只看該時間點前的訂單
function dormantCountAsOf(orders: any[], refTime: number): number {
  const m = new Map<string, { count: number; last: number }>()
  for (const o of orders) {
    const t = new Date(o.created_at).getTime()
    if (t > refTime) continue
    const phone = (o.phone || '').trim()
    if (!phone) continue
    const a = m.get(phone)
    if (!a) m.set(phone, { count: 1, last: t })
    else { a.count++; if (t > a.last) a.last = t }
  }
  let dormant = 0
  for (const a of m.values()) {
    const days = Math.floor((refTime - a.last) / DAY_MS)
    if (classify(a.count, days) === 'dormant') dormant++
  }
  return dormant
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  // customer spend/contact data is sensitive — 需 orders.view 權限或超級管理員
  const canView = admin.permissions.includes('all') ||
    admin.permissions.includes('orders.view') ||
    admin.role_key === 'customer_service'
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

  // ── 今日營運指標（台灣時間）──
  const nowTW = new Date(now + 8 * 60 * 60 * 1000)
  const todayStartMs = new Date(nowTW.toISOString().slice(0, 10) + 'T00:00:00+08:00').getTime()

  // 今日復購人數（今日有下單、且今日之前曾下過單）＋ 今日喚醒沉睡客
  const lastBeforeToday = new Map<string, number>()
  const orderedTodayPhones = new Set<string>()
  for (const o of orders) {
    const phone = (o.phone || '').trim()
    if (!phone) continue
    const t = new Date(o.created_at).getTime()
    if (t < todayStartMs) lastBeforeToday.set(phone, Math.max(lastBeforeToday.get(phone) || 0, t))
    else orderedTodayPhones.add(phone)
  }
  let repurchaseToday = 0
  let reactivatedToday = 0
  for (const phone of orderedTodayPhones) {
    const prev = lastBeforeToday.get(phone)
    if (prev != null) {
      repurchaseToday++
      if (Math.floor((todayStartMs - prev) / DAY_MS) > DORMANT_DAYS) reactivatedToday++
    }
  }

  // 沉睡客戶數（現在）與今日變化
  const dormantNow = customers.filter(c => c.segment === 'dormant').length
  const dormantChangeToday = dormantNow - dormantCountAsOf(orders, todayStartMs)

  // 老客戶（回購 ≥2 次）營收占比
  const returningRevenue = customers.filter(c => c.order_count >= 2).reduce((s, c) => s + c.total_amount, 0)
  const returningRevenueShare = totalRevenue > 0 ? Math.round((returningRevenue / totalRevenue) * 1000) / 10 : 0

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
    // 今日營運
    repurchase_today: repurchaseToday,
    reactivated_today: reactivatedToday,
    returning_revenue_share: returningRevenueShare,
    dormant_count: dormantNow,
    dormant_change_today: dormantChangeToday,
    vip_count: customers.filter(c => c.segment === 'vip').length,
    lost_count: customers.filter(c => c.segment === 'lost').length,
    due_count: 0, // 稍後填入
  }

  // 3b. 每位客戶「預估下次回購日」與逾期天數（個人回購週期優先，否則用全站平均）
  const globalCycle = summary.avg_repurchase_days
  for (const c of customers as any[]) {
    const cycle = c.avg_repurchase_days ?? globalCycle
    if (cycle && cycle > 0) {
      const expectedMs = new Date(c.last_order_at).getTime() + cycle * DAY_MS
      c.expected_next_at = new Date(expectedMs).toISOString()
      c.overdue_days = Math.floor((now - expectedMs) / DAY_MS) // >0 已逾期、<0 未到期
    } else {
      c.expected_next_at = null
      c.overdue_days = null
    }
  }
  // 待喚醒：已過預估回購日、且尚未完全流失（仍值得聯繫）
  const isDue = (c: any) => c.overdue_days != null && c.overdue_days > 0 && c.segment !== 'lost'
  summary.due_count = (customers as any[]).filter(isDue).length

  // 4. Filter (search / segment)
  if (search) {
    customers = customers.filter(c =>
      c.phone.includes(search) ||
      c.customer_name.toLowerCase().includes(search) ||
      c.line_id.toLowerCase().includes(search)
    )
  }
  if (segment === 'due') {
    customers = (customers as any[]).filter(isDue)
  } else if (segment) {
    customers = customers.filter(c => c.segment === segment)
  }

  // 5. Sort
  const sorters: Record<string, (a: any, b: any) => number> = {
    amount_desc: (a, b) => b.total_amount - a.total_amount,
    amount_asc: (a, b) => a.total_amount - b.total_amount,
    orders_desc: (a, b) => b.order_count - a.order_count,
    recent_desc: (a, b) => new Date(b.last_order_at).getTime() - new Date(a.last_order_at).getTime(),
    inactive_desc: (a, b) => b.days_since_last_order - a.days_since_last_order,
    due_desc: (a, b) => (b.overdue_days ?? -Infinity) - (a.overdue_days ?? -Infinity),
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
