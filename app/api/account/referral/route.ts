import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { getOrCreateCode, referralResults } from '@/lib/referralRepo'
import { withReferral } from '@/lib/referral'
import { SITE_URL } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'

/** 會員：我的推薦碼、專屬連結、成效（點擊、註冊、下單、新朋友） */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const code = await getOrCreateCode(auth.user.id)
  if (!code) return NextResponse.json({ success: true, ready: false }, { headers: { 'Cache-Control': 'no-store' } })

  const [visits, signups, results] = await Promise.all([
    supabaseAdmin.from('referral_visits').select('id', { count: 'exact', head: true }).eq('code', code),
    supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('referred_by', code),
    referralResults({ code }),
  ])
  const o = results.outcome.get(code)
  return NextResponse.json({
    success: true, ready: true, code,
    link: withReferral(`${SITE_URL}/`, code, 'invite'),
    stats: { visits: visits.count || 0, signups: signups.count || 0, orders: o?.orders || 0, friends: o?.buyers || 0, new_customers: o?.new_customers || 0 },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
