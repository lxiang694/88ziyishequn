import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { data: event, error } = await supabaseAdmin
    .from('community_events').select('*').eq('id', params.id).single()
  if (error || !event) return NextResponse.json({ success: false, error: '找不到此活動' }, { status: 404 })

  const { data: registrations } = await supabaseAdmin
    .from('community_event_registrations')
    .select('*')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ success: true, data: { event, registrations: registrations || [] } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const updateData: any = { updated_at: new Date().toISOString() }
    const allowed = ['title', 'address', 'event_time', 'description', 'is_active']
    for (const k of allowed) {
      if (body[k] !== undefined) updateData[k] = typeof body[k] === 'string' ? body[k].trim() : body[k]
    }
    if (body.starts_at !== undefined) updateData.starts_at = body.starts_at || null
    if (updateData.title === '') return NextResponse.json({ success: false, error: '活動名稱不可為空' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('community_events').update(updateData).eq('id', params.id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  if (!admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '只有超級管理員可刪除活動' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('community_events').delete().eq('id', params.id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
