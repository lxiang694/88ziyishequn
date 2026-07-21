import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isEventRegistrationClosed } from '@/lib/utils'

// GET /api/events/[slug] — public event info (no auth)
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const { data, error } = await supabaseAdmin
    .from('community_events')
    .select('id, slug, title, address, event_time, description, starts_at')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: '找不到此活動' }, { status: 404 })
  return NextResponse.json({
    success: true,
    data: { ...data, registration_closed: isEventRegistrationClosed(data.starts_at) },
  })
}
