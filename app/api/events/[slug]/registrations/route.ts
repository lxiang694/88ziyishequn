import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateTWPhone } from '@/lib/utils'

function maskName(name: string): string {
  const s = name.trim()
  if (s.length <= 1) return s
  if (s.length === 2) return s[0] + '*'
  return s[0] + '*'.repeat(Math.min(s.length - 2, 2)) + s[s.length - 1]
}

function maskPhone(phone: string): string {
  const p = phone.trim()
  if (p.length < 7) return '*'.repeat(p.length)
  return p.slice(0, 4) + '*'.repeat(p.length - 6) + p.slice(-2)
}

// GET /api/events/[slug]/registrations — public, masked names/phones only
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const { data: event } = await supabaseAdmin
    .from('community_events').select('id').eq('slug', params.slug).eq('is_active', true).single()
  if (!event) return NextResponse.json({ success: false, error: '找不到此活動' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('community_event_registrations')
    .select('name, phone, companions, created_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const masked = (data || []).map(r => ({
    name: maskName(r.name),
    phone: maskPhone(r.phone),
    companions: r.companions,
    created_at: r.created_at,
  }))
  return NextResponse.json({ success: true, data: masked, total: masked.length })
}

// POST /api/events/[slug]/registrations — public sign-up
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { data: event } = await supabaseAdmin
    .from('community_events').select('id').eq('slug', params.slug).eq('is_active', true).single()
  if (!event) return NextResponse.json({ success: false, error: '找不到此活動' }, { status: 404 })

  try {
    const body = await req.json()
    const { name, phone, topic, companions } = body

    if (!name?.trim()) return NextResponse.json({ success: false, error: '請填寫姓名' }, { status: 400 })
    if (!phone || !validateTWPhone(phone)) return NextResponse.json({ success: false, error: '請填寫正確的手機號碼（09xxxxxxxx）' }, { status: 400 })
    const companionsNum = Number(companions)
    if (!Number.isInteger(companionsNum) || companionsNum < 0 || companionsNum > 5) {
      return NextResponse.json({ success: false, error: '同行人數格式錯誤' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('community_event_registrations')
      .insert({
        event_id: event.id,
        name: name.trim(),
        phone: phone.trim(),
        topic: topic?.trim() || null,
        companions: companionsNum,
      })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '報名失敗，請稍後再試' }, { status: 500 })
  }
}
