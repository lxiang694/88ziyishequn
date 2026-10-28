import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { normalizeCode } from '@/lib/referral'
import { codeOwner } from '@/lib/referralRepo'

/**
 * 會員註冊（或登入）時，瀏覽器裡記著朋友的推薦碼：記成「這位會員是誰推薦的」。
 * 只記第一次；自己的推薦碼不算。
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => ({}))
  const code = normalizeCode(body?.code)
  if (!code) return NextResponse.json({ success: false, error: '推薦碼格式錯誤' }, { status: 400 })
  const owner = await codeOwner(code)
  if (!owner || owner.user_id === auth.user.id) return NextResponse.json({ success: true, claimed: false })
  const { data, error } = await supabaseAdmin.from('user_profiles').update({ referred_by: code })
    .eq('id', auth.user.id).is('referred_by', null).select('id')
  if (error) return NextResponse.json({ success: true, claimed: false })
  return NextResponse.json({ success: true, claimed: !!data?.length })
}
