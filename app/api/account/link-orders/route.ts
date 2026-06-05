import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/account/link-orders
 * Retroactively link old orders (placed before signup) to this user
 * by matching customer phone number.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  // Get user's phone
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.phone) {
    return NextResponse.json({ success: true, linked: 0, message: '請先在個人資料填寫手機號碼' })
  }

  // Update all orders matching this phone that don't yet have a user_id
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ user_id: user.id })
    .eq('phone', profile.phone)
    .is('user_id', null)
    .select('id')

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, linked: data?.length || 0 })
}
