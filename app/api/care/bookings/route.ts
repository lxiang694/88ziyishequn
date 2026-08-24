import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromRequest } from '@/lib/userAuth'
import { validateTWPhone } from '@/lib/utils'

export const runtime = 'nodejs'

function genBookingNo(): string {
  const tw = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const d = tw.toISOString().slice(0, 10).replace(/-/g, '')
  return `CA${d}${Math.floor(100000 + Math.random() * 900000)}`
}

/** 公開：送出陪診預約（不收款，由客服確認後提供匯款帳戶） */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()

    const required: [string, string][] = [
      ['patient_name', '請填寫就診人姓名'],
      ['contact_name', '請填寫聯絡人姓名'],
      ['contact_phone', '請填寫聯絡人手機'],
      ['service_date', '請選擇就診日期'],
      ['service_code', '請選擇陪診方案'],
    ]
    for (const [field, msg] of required) {
      if (!b?.[field] || String(b[field]).trim() === '') {
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }
    }
    if (!validateTWPhone(String(b.contact_phone).trim())) {
      return NextResponse.json({ success: false, error: '請填寫正確的手機號碼（09xxxxxxxx）' }, { status: 400 })
    }

    // 以伺服器端的方案定價為準，避免前端被竄改價格
    const { data: svc } = await supabaseAdmin
      .from('care_services')
      .select('code, name, price')
      .eq('code', b.service_code)
      .eq('is_active', true)
      .single()
    if (!svc) return NextResponse.json({ success: false, error: '所選方案不存在或已下架' }, { status: 400 })

    const authedUser = await getUserFromRequest(req).catch(() => null)

    const booking_no = genBookingNo()
    const { data, error } = await supabaseAdmin
      .from('care_bookings')
      .insert({
        booking_no,
        service_code: svc.code,
        service_name: svc.name,
        price: svc.price,
        patient_name: String(b.patient_name).trim(),
        patient_age: b.patient_age || null,
        patient_gender: b.patient_gender || null,
        mobility: b.mobility || null,
        contact_name: String(b.contact_name).trim(),
        contact_phone: String(b.contact_phone).trim(),
        contact_line: b.contact_line || null,
        relation: b.relation || null,
        service_date: b.service_date,
        time_slot: b.time_slot || null,
        county: b.county || null,
        hospital: b.hospital || null,
        department: b.department || null,
        addons: Array.isArray(b.addons) ? b.addons : [],
        notes: b.notes || null,
        user_id: authedUser?.id || null,
        status: '待確認',
      })
      .select('booking_no, service_name, price, service_date')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '預約送出失敗，請稍後再試' }, { status: 500 })
  }
}
