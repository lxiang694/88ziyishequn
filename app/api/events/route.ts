import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isEventRegistrationClosed } from '@/lib/utils'

// GET /api/events — public list of all events (active + upcoming/closed shown greyed out)
export async function GET() {
  const { data: events, error } = await supabaseAdmin
    .from('community_events')
    .select('id, slug, title, address, event_time, is_active, starts_at, created_at')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const { data: regs } = await supabaseAdmin
    .from('community_event_registrations')
    .select('event_id')
  const countMap = new Map<string, number>()
  for (const r of regs || []) countMap.set(r.event_id, (countMap.get(r.event_id) || 0) + 1)

  const data = (events || []).map(e => ({
    slug: e.slug,
    title: e.title,
    address: e.address,
    event_time: e.event_time,
    is_active: e.is_active,
    registration_closed: isEventRegistrationClosed(e.starts_at),
    registration_count: countMap.get(e.id) || 0,
  }))
  return NextResponse.json({ success: true, data })
}
