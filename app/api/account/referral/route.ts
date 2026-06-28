import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { genReferralCode, inviteLink, REFERRAL_POINTS } from '@/lib/referral'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/account/referral
 * 取得目前會員的邀請碼、邀請連結、已成功邀請人數、累積積分與紀錄。
 * 若會員還沒有邀請碼，會在此產生並寫回 user_profiles。
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  // 1. 讀 profile（含邀請碼、積分）；不存在則建立
  let { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('referral_code, points')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    const { data: created } = await supabaseAdmin
      .from('user_profiles')
      .insert({ id: user.id })
      .select('referral_code, points')
      .single()
    profile = created
  }

  // 2. 沒有邀請碼就產生一組（碰撞就重試）
  let code = profile?.referral_code as string | null
  if (!code) {
    for (let attempt = 0; attempt < 8 && !code; attempt++) {
      const candidate = genReferralCode(6)
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ referral_code: candidate })
        .eq('id', user.id)
        .is('referral_code', null)
      if (!error) {
        // 確認確實寫進去的是這組（避免唯一鍵衝突時被忽略）
        const { data: check } = await supabaseAdmin
          .from('user_profiles')
          .select('referral_code')
          .eq('id', user.id)
          .maybeSingle()
        if (check?.referral_code) code = check.referral_code
      }
    }
  }

  // 3. 邀請紀錄（最近 50 筆）
  const { data: referrals } = await supabaseAdmin
    .from('line_referrals')
    .select('id, code, status, points_awarded, created_at')
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const invitedCount = referrals?.length || 0

  return NextResponse.json(
    {
      success: true,
      data: {
        code,
        link: code ? inviteLink(code) : null,
        points: profile?.points || 0,
        rewardPerInvite: REFERRAL_POINTS,
        invitedCount,
        referrals: referrals || [],
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
