import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'

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
    const updateData: any = {}
    const allowed = [
      'name', 'phone', 'line_id',
      'default_store_id', 'default_store_name', 'default_store_address',
      'default_store_county', 'default_store_district',
    ]
    for (const k of allowed) {
      if (body[k] !== undefined) updateData[k] = body[k] || null
    }

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}
