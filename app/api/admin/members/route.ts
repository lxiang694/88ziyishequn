import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'
import { getTWDateRange } from '@/lib/adminDateRange'

export const runtime = 'nodejs'

const PER_PAGE = 1000
const MAX_PAGES = 50 // 安全上限（最多 5 萬名會員）

/**
 * 會員清單 — 來源為 Supabase Auth（auth.users）+ user_profiles。
 * 僅限超級管理員。
 */
export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth

  // 1. 逐頁抓取所有註冊會員
  const authUsers: any[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    const users = data?.users || []
    authUsers.push(...users)
    if (users.length < PER_PAGE) break
  }

  // 2. 取 user_profiles（姓名 / 手機等）
  const profileMap = new Map<string, any>()
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, name, phone, line_id, created_at')
  for (const p of profiles || []) profileMap.set(p.id, p)

  // 3. 統計每位會員的訂單數
  const orderCount = new Map<string, number>()
  const { data: orderRows } = await supabaseAdmin
    .from('orders')
    .select('user_id')
    .not('user_id', 'is', null)
  for (const o of orderRows || []) {
    if (o.user_id) orderCount.set(o.user_id, (orderCount.get(o.user_id) || 0) + 1)
  }

  // 4. 組合會員資料
  const members = authUsers.map(u => {
    const prof = profileMap.get(u.id) || {}
    return {
      id: u.id,
      email: u.email || '',
      name: prof.name || u.user_metadata?.name || '',
      phone: prof.phone || u.user_metadata?.phone || '',
      line_id: prof.line_id || '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      email_confirmed: !!(u.email_confirmed_at || u.confirmed_at),
      order_count: orderCount.get(u.id) || 0,
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // 5. 統計卡片：總數、今日新增、本月新增
  const todayRange = getTWDateRange('today')
  const monthRange = getTWDateRange('month')
  const inRange = (d: string, r: { start: string; end: string }) => d >= r.start && d <= r.end
  const newToday = members.filter(m => inRange(m.created_at, todayRange)).length
  const newMonth = members.filter(m => inRange(m.created_at, monthRange)).length

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        total: members.length,
        new_today: newToday,
        new_month: newMonth,
        verified: members.filter(m => m.email_confirmed).length,
      },
      members,
    },
  })
}
