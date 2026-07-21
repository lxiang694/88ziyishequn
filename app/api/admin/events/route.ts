import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9一-鿿-]/g, '').slice(0, 60)
}

export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'events.view')
  if (auth instanceof NextResponse) return auth

  const { data: events, error } = await supabaseAdmin
    .from('community_events')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const { data: regs } = await supabaseAdmin
    .from('community_event_registrations')
    .select('event_id')
  const countByEvent = new Map<string, number>()
  for (const r of regs || []) countByEvent.set(r.event_id, (countByEvent.get(r.event_id) || 0) + 1)

  const data = (events || []).map(e => ({ ...e, registration_count: countByEvent.get(e.id) || 0 }))
  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  const auth = requirePermission(req, 'events.view')
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { title, address, event_time, description, is_active, starts_at } = body
    let { slug } = body

    if (!title?.trim()) return NextResponse.json({ success: false, error: '請填寫活動名稱' }, { status: 400 })
    slug = slug?.trim() ? slugify(slug) : slugify(title)
    if (!slug) return NextResponse.json({ success: false, error: '無法產生網址代稱，請手動輸入' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('community_events')
      .insert({
        slug,
        title: title.trim(),
        address: address?.trim() || '',
        event_time: event_time?.trim() || '',
        description: description?.trim() || '',
        is_active: is_active !== false,
        starts_at: starts_at || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: '此網址代稱已被使用，請換一個' }, { status: 400 })
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '建立失敗' }, { status: 500 })
  }
}
