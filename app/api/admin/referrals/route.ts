import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'
import { getTWDateRange } from '@/lib/adminDateRange'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 邀請裂變成效 — 僅限超級管理員。
 * 回傳：總邀請數、發出積分、今日/本月邀請、邀請排行榜。
 */
export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth

  // 1. 取所有邀請紀錄
  const { data: referrals, error } = await supabaseAdmin
    .from('line_referrals')
    .select('referrer_user_id, points_awarded, created_at')

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const rows = referrals || []

  // 2. 統計卡片
  const todayRange = getTWDateRange('today')
  const monthRange = getTWDateRange('month')
  const inRange = (d: string, r: { start: string; end: string }) => d >= r.start && d <= r.end

  const totalReferrals = rows.length
  const totalPoints = rows.reduce((s, r) => s + (r.points_awarded || 0), 0)
  const today = rows.filter(r => inRange(r.created_at, todayRange)).length
  const month = rows.filter(r => inRange(r.created_at, monthRange)).length

  // 3. 排行榜：依邀請人分組
  const byReferrer = new Map<string, { count: number; points: number }>()
  for (const r of rows) {
    const cur = byReferrer.get(r.referrer_user_id) || { count: 0, points: 0 }
    cur.count += 1
    cur.points += r.points_awarded || 0
    byReferrer.set(r.referrer_user_id, cur)
  }

  // 4. 補上邀請人姓名 / 手機 / 邀請碼
  const referrerIds = Array.from(byReferrer.keys())
  const profileMap = new Map<string, any>()
  if (referrerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, phone, referral_code, points')
      .in('id', referrerIds)
    for (const p of profiles || []) profileMap.set(p.id, p)
  }

  const leaderboard = referrerIds
    .map(id => {
      const stat = byReferrer.get(id)!
      const prof = profileMap.get(id) || {}
      return {
        user_id: id,
        name: prof.name || '(未填姓名)',
        phone: prof.phone || '',
        referral_code: prof.referral_code || '',
        total_points: prof.points || 0,
        invited: stat.count,
        points_from_referral: stat.points,
      }
    })
    .sort((a, b) => b.invited - a.invited)

  return NextResponse.json({
    success: true,
    data: {
      summary: { totalReferrals, totalPoints, today, month },
      leaderboard,
    },
  })
}
