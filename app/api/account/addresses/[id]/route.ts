import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { validateTWPhone } from '@/lib/utils'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const body = await req.json()
    const updateData: any = {}
    const allowed = [
      'label', 'recipient_name', 'phone', 'line_id',
      'store_id', 'store_name', 'store_address', 'store_county', 'store_district',
      'is_default',
    ]
    for (const k of allowed) {
      if (body[k] !== undefined) updateData[k] = body[k] === '' ? null : body[k]
    }
    if (updateData.phone && !validateTWPhone(updateData.phone)) {
      return NextResponse.json({ success: false, error: '手機號碼格式錯誤' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('saved_addresses').select('id').eq('id', params.id).eq('user_id', user.id).maybeSingle()
    if (!existing) return NextResponse.json({ success: false, error: '找不到此收件資訊' }, { status: 404 })

    if (updateData.is_default === true) {
      await supabaseAdmin.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id)
    }

    const { error } = await supabaseAdmin
      .from('saved_addresses').update(updateData).eq('id', params.id).eq('user_id', user.id)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  const { error } = await supabaseAdmin
    .from('saved_addresses').delete().eq('id', params.id).eq('user_id', user.id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
