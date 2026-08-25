import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion, COMPANION_COOKIE } from '@/lib/companionAuth'

export const runtime = 'nodejs'

/** 取得目前登入的陪診員資料 */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, name, phone, email, gender, employment_type, service_areas, certifications, bio, status, completed_count, profile_submitted_at, reject_reason')
    .eq('id', auth.companion.id)
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: '找不到帳號' }, { status: 404 })
  if (data.status === 'suspended') return NextResponse.json({ success: false, error: '帳號已停用' }, { status: 403 })
  return NextResponse.json({ success: true, data })
}

/** 登出 */
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(COMPANION_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}
