import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { sanitizeProfilePatch } from '@/lib/orderSecurity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // If profile not auto-created (edge case), create one now
  if (!data) {
    const { data: created } = await supabaseAdmin
      .from('user_profiles')
      .insert({ id: user.id })
      .select()
      .single()
    return NextResponse.json(
      { success: true, data: created },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const body = await req.json()
    // 手機一定要是 09 開頭 10 碼：這個值之後會被拿去比對訂單，不能放任意字串
    const { value: updateData, error: invalid } = sanitizeProfilePatch(body)
    if (!updateData) return NextResponse.json({ success: false, error: invalid }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}
