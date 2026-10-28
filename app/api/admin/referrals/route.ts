import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { referralResults } from '@/lib/referralRepo'

export const dynamic = 'force-dynamic'
const PERIODS: Record<string, number | null> = { '30': 30, '90': 90, '365': 365, all: null }

/**
 * 後台「好友推薦」成效：點擊、註冊、推薦訂單、新客，推薦人排行與最近的推薦訂單。
 * 客人姓名、手機屬於敏感資料：需要「查看訂單」權限或超級管理員。
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('orders.view') && admin.role_key !== 'customer_service') {
    return NextResponse.json({ success: false, error: '無權限查看推薦資料' }, { status: 403 })
  }
  const period = new URL(req.url).searchParams.get('period') || '30'
  const days = period in PERIODS ? PERIODS[period] : 30
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined

  const visitsQ = supabaseAdmin.from('referral_visits').select('code').order('created_at', { ascending: false }).limit(20000)
  const signupsQ = supabaseAdmin.from('user_profiles').select('referred_by, created_at').not('referred_by', 'is', null).limit(20000)
  const [visits, signups, codesCount, results] = await Promise.all([
    since ? visitsQ.gte('created_at', since) : visitsQ,
    since ? signupsQ.gte('created_at', since) : signupsQ,
    supabaseAdmin.from('referral_codes').select('code', { count: 'exact', head: true }),
    referralResults({ since }),
  ])
  if (visits.error || codesCount.error || !results.ready) {
    return NextResponse.json({ success: true, data: { ready: false } }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const tally = (rows: { [k: string]: any }[], key: string) => {
    const m = new Map<string, number>()
    for (const r of rows) if (r[key]) m.set(r[key], (m.get(r[key]) || 0) + 1)
    return m
  }
  const visitBy = tally(visits.data || [], 'code')
  const signupBy = tally(signups.error ? [] : signups.data || [], 'referred_by')

  // 推薦人是誰
  const codes = [...new Set([...visitBy.keys(), ...signupBy.keys(), ...results.outcome.keys()])]
  const owners = new Map<string, { name: string; phone: string }>()
  for (let i = 0; i < codes.length; i += 200) {
    const { data: rc } = await supabaseAdmin.from('referral_codes').select('code, user_id').in('code', codes.slice(i, i + 200))
    const ids = (rc || []).map(r => r.user_id)
    const { data: profiles } = ids.length ? await supabaseAdmin.from('user_profiles').select('id, name, phone').in('id', ids) : { data: [] as any[] }
    const byId = new Map((profiles || []).map((p: any) => [p.id, p]))
    for (const r of rc || []) {
      const p: any = byId.get(r.user_id)
      owners.set(r.code, { name: p?.name || '（未填姓名）', phone: p?.phone || '' })
    }
  }

  const ranking = codes.map(code => {
    const o = results.outcome.get(code)
    return {
      code, ...(owners.get(code) || { name: '（已刪除的會員）', phone: '' }),
      visits: visitBy.get(code) || 0, signups: signupBy.get(code) || 0,
      orders: o?.orders || 0, buyers: o?.buyers || 0, new_customers: o?.new_customers || 0, revenue: o?.revenue || 0,
    }
  }).sort((a, b) => b.new_customers - a.new_customers || b.revenue - a.revenue || b.visits - a.visits)

  const sum = (k: 'visits' | 'signups' | 'orders' | 'new_customers' | 'revenue') => ranking.reduce((s, r) => s + r[k], 0)
  const recent = results.orders.slice(0, 30).map(o => ({
    order_no: o.order_no, kind: o.kind, customer_name: o.customer_name, total: o.total, created_at: o.created_at,
    referrer: owners.get(o.referral_code)?.name || o.referral_code,
    is_new: results.firstOrderByPhone?.get(o.phone) === o.order_no,
  }))

  return NextResponse.json({
    success: true,
    data: {
      ready: true, period,
      summary: {
        members_with_link: codesCount.count || 0,
        sharers: ranking.filter(r => r.visits > 0).length,
        visits: sum('visits'), signups: sum('signups'), orders: sum('orders'),
        new_customers: sum('new_customers'), revenue: sum('revenue'),
      },
      ranking: ranking.slice(0, 100),
      recent,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
