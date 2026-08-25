import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion } from '@/lib/companionAuth'

export const runtime = 'nodejs'

/** 取得指派給自己的陪診工作 */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('care_bookings')
    .select('id, booking_no, service_name, service_date, time_slot, county, hospital, department, patient_name, patient_gender, patient_age, mobility, addons, notes, status, contact_name, contact_phone, price, accepted_at, contact_confirmed_at, met_at, pickup_address, pickup_time, pickup_note, addon_fee, addon_companion_fee, companion_fee, extra_companion_fee')
    .eq('companion_id', auth.companion.id)
    .in('status', ['已派工', '服務中', '已完成'])
    .order('service_date', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [] })
}

/** 陪診員回報進度：開始服務 / 完成服務 */
export async function PATCH(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id, action } = await req.json()
    if (!id || !['start', 'finish'].includes(action)) {
      return NextResponse.json({ success: false, error: '參數錯誤' }, { status: 400 })
    }

    // 僅能操作指派給自己的工作
    const { data: booking } = await supabaseAdmin
      .from('care_bookings')
      .select('id, status, companion_id')
      .eq('id', id)
      .eq('companion_id', auth.companion.id)
      .single()
    if (!booking) return NextResponse.json({ success: false, error: '查無此工作' }, { status: 404 })

    const next = action === 'start' ? '服務中' : '已完成'
    if (action === 'start' && booking.status !== '已派工') {
      return NextResponse.json({ success: false, error: '此工作目前無法開始' }, { status: 400 })
    }
    if (action === 'finish' && booking.status !== '服務中') {
      return NextResponse.json({ success: false, error: '請先開始服務' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('care_bookings')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    // 完成時累計服務場次
    if (action === 'finish') {
      const { data: c } = await supabaseAdmin
        .from('companions').select('completed_count').eq('id', auth.companion.id).single()
      await supabaseAdmin
        .from('companions')
        .update({ completed_count: (c?.completed_count || 0) + 1 })
        .eq('id', auth.companion.id)
    }

    return NextResponse.json({ success: true, status: next })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}
