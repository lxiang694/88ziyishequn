import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion } from '@/lib/companionAuth'

export const runtime = 'nodejs'

const VALID = ['accepted', 'declined', 'contacted', 'met', 'progress', 'doctor_note', 'completed']

/** 取得某筆工單的服務記錄（僅限自己的工單） */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const bookingId = Number(searchParams.get('booking_id') || 0)
  if (!bookingId) return NextResponse.json({ success: false, error: '缺少 booking_id' }, { status: 400 })

  const { data: booking } = await supabaseAdmin
    .from('care_bookings').select('id').eq('id', bookingId).eq('companion_id', auth.companion.id).single()
  if (!booking) return NextResponse.json({ success: false, error: '查無此工單' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('care_booking_events')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ success: true, data: [], table_missing: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data: data || [] })
}

/** 新增一筆服務記錄，並同步更新工單狀態 */
export async function POST(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { booking_id, event_type, note, photos } = await req.json()
    if (!booking_id || !VALID.includes(event_type)) {
      return NextResponse.json({ success: false, error: '參數錯誤' }, { status: 400 })
    }

    const { data: booking } = await supabaseAdmin
      .from('care_bookings')
      .select('id, status, companion_id')
      .eq('id', booking_id)
      .eq('companion_id', auth.companion.id)
      .single()
    if (!booking) return NextResponse.json({ success: false, error: '查無此工單' }, { status: 404 })

    if (event_type === 'declined' && !String(note || '').trim()) {
      return NextResponse.json({ success: false, error: '婉拒時請填寫原因，方便客服重新安排' }, { status: 400 })
    }
    if (event_type === 'doctor_note' && !String(note || '').trim()) {
      return NextResponse.json({ success: false, error: '請填寫醫師交代的重點' }, { status: 400 })
    }

    const { error: insErr } = await supabaseAdmin.from('care_booking_events').insert({
      booking_id,
      companion_id: auth.companion.id,
      event_type,
      note: note || null,
      photos: Array.isArray(photos) ? photos : [],
    })
    if (insErr) {
      if (insErr.code === '42P01') {
        return NextResponse.json({ success: false, error: '服務記錄表尚未建立，請先執行 companion_profile_records.sql' }, { status: 500 })
      }
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 })
    }

    // 同步工單上的快取欄位與狀態
    const now = new Date().toISOString()
    const upd: any = { updated_at: now }
    if (event_type === 'accepted') upd.accepted_at = now
    if (event_type === 'declined') {
      upd.declined_at = now
      upd.decline_reason = note || null
      upd.companion_id = null          // 退回未派工，讓客服重新安排
      upd.status = '已付款'
    }
    if (event_type === 'contacted') upd.contact_confirmed_at = now
    if (event_type === 'met') { upd.met_at = now; upd.status = '服務中' }
    if (event_type === 'doctor_note') {
      const { data: b } = await supabaseAdmin.from('care_bookings').select('doctor_notes').eq('id', booking_id).single()
      upd.doctor_notes = [b?.doctor_notes, note].filter(Boolean).join('\n')
    }
    if (event_type === 'completed') { upd.completed_at = now; upd.status = '已完成' }

    await supabaseAdmin.from('care_bookings').update(upd).eq('id', booking_id)

    // 完成時累計服務場次
    if (event_type === 'completed') {
      const { data: c } = await supabaseAdmin
        .from('companions').select('completed_count').eq('id', auth.companion.id).single()
      await supabaseAdmin.from('companions')
        .update({ completed_count: (c?.completed_count || 0) + 1 })
        .eq('id', auth.companion.id)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '回報失敗' }, { status: 500 })
  }
}
