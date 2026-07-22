import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { DAY_MS, twDate, twMonth, segmentCountsAsOf } from '@/lib/rfm'

export const runtime = 'nodejs'

const FETCH_BATCH = 1000
const MAX_BATCHES = 100

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

  // 抓所有非取消訂單（依時間由舊到新）
  const orders: { phone: string | null; total_amount: any; created_at: string }[] = []
  for (let i = 0; i < MAX_BATCHES; i++) {
    const from = i * FETCH_BATCH
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('phone, total_amount, created_at')
      .neq('order_status', '已取消')
      .not('phone', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + FETCH_BATCH - 1)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    const rows = data || []
    orders.push(...rows)
    if (rows.length < FETCH_BATCH) break
  }

  const now = Date.now()
  const nowTW = new Date(now + 8 * 60 * 60 * 1000)
  const todayStr = nowTW.toISOString().slice(0, 10)

  // ── 1. 近 30 天：每日新客 vs 回頭客（去重到人）──
  const dailyNew = new Map<string, Set<string>>()
  const dailyReturning = new Map<string, Set<string>>()
  const firstDateByPhone = new Map<string, string>()
  const add = (m: Map<string, Set<string>>, k: string, v: string) => {
    let s = m.get(k); if (!s) { s = new Set(); m.set(k, s) } s.add(v)
  }
  for (const o of orders) {
    const phone = (o.phone || '').trim(); if (!phone) continue
    const d = twDate(o.created_at)
    const first = firstDateByPhone.get(phone)
    if (first === undefined) { firstDateByPhone.set(phone, d); add(dailyNew, d, phone) }
    else if (first < d) { add(dailyReturning, d, phone) }
  }
  const daily: { date: string; new_customers: number; returning_customers: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(nowTW.getTime() - i * DAY_MS).toISOString().slice(0, 10)
    daily.push({
      date: d,
      new_customers: dailyNew.get(d)?.size || 0,
      returning_customers: dailyReturning.get(d)?.size || 0,
    })
  }

  // ── 2. 近 6 個月：新客營收 vs 老客營收（依每筆訂單當下是否為首購分類）──
  const monthlyMap = new Map<string, { new_rev: number; returning_rev: number }>()
  const seen = new Set<string>()
  for (const o of orders) {
    const phone = (o.phone || '').trim(); if (!phone) continue
    const m = twMonth(o.created_at)
    let bucket = monthlyMap.get(m)
    if (!bucket) { bucket = { new_rev: 0, returning_rev: 0 }; monthlyMap.set(m, bucket) }
    const amount = parseFloat(o.total_amount || 0)
    if (!seen.has(phone)) { bucket.new_rev += amount; seen.add(phone) }
    else { bucket.returning_rev += amount }
  }
  const monthly: { month: string; new_rev: number; returning_rev: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(nowTW.getFullYear(), nowTW.getMonth() - i, 1)
    const m = dt.toISOString().slice(0, 7)
    const b = monthlyMap.get(m) || { new_rev: 0, returning_rev: 0 }
    monthly.push({ month: m, new_rev: Math.round(b.new_rev), returning_rev: Math.round(b.returning_rev) })
  }

  // ── 3. 近 8 週：沉睡 / 流失客戶數（每週快照）──
  const weekly: { date: string; dormant: number; lost: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const t = now - i * 7 * DAY_MS
    const { dormant, lost } = segmentCountsAsOf(orders, t)
    weekly.push({ date: new Date(t + 8 * 60 * 60 * 1000).toISOString().slice(0, 10), dormant, lost })
  }

  return NextResponse.json({ success: true, data: { daily, monthly, weekly, today: todayStr } })
}
