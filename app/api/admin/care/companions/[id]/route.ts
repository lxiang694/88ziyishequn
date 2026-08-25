import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

const DOC_FIELDS = ['doc_id_front', 'doc_id_back', 'doc_bankbook', 'doc_education', 'doc_certificate'] as const

/**
 * 陪診員完整資料（含證件簽名網址、排班、近期工單）
 * 證件與身分證字號屬敏感個資，僅超級管理員可查看，且以 5 分鐘簽名網址提供。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const isSuper = auth.admin.permissions.includes('all')
  if (!isSuper && !auth.admin.permissions.includes('care.view')) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  const id = Number(params.id)
  const { data, error } = await supabaseAdmin.from('companions').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ success: false, error: '查無此陪診員' }, { status: 404 })

  const { password_hash, ...row } = data as any

  // 非超級管理員：隱藏身分證字號、金融帳號與證件
  if (!isSuper) {
    row.id_number = row.id_number ? '***已隱藏***' : null
    row.bank_account = row.bank_account ? '***已隱藏***' : null
    for (const f of DOC_FIELDS) row[f] = null
  }

  // 證件簽名網址（僅超級管理員）
  const docs: Record<string, string | null> = {}
  if (isSuper) {
    for (const f of DOC_FIELDS) {
      const path = (data as any)[f]
      if (!path) { docs[f] = null; continue }
      const { data: signed } = await supabaseAdmin.storage
        .from('companion-docs').createSignedUrl(path, 300)
      docs[f] = signed?.signedUrl || null
    }
  }

  // 未來排班
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: avail } = await supabaseAdmin
    .from('companion_availability')
    .select('date, time_slot')
    .eq('companion_id', id)
    .gte('date', today)
    .order('date', { ascending: true })

  // 近期工單
  const { data: bookings } = await supabaseAdmin
    .from('care_bookings')
    .select('id, booking_no, service_date, service_name, hospital, status, companion_fee, settled_at')
    .eq('companion_id', id)
    .order('service_date', { ascending: false })
    .limit(20)

  return NextResponse.json({
    success: true,
    data: { ...row, docs, availability: avail || [], bookings: bookings || [] },
  })
}

/** 審核：通過 / 退回 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '僅超級管理員可審核' }, { status: 403 })
  }

  try {
    const { action, reject_reason } = await req.json()
    const id = Number(params.id)
    const now = new Date().toISOString()

    if (action === 'approve') {
      const { error } = await supabaseAdmin.from('companions').update({
        status: 'active', reviewed_at: now, reviewed_by: auth.admin.name, reject_reason: null,
      }).eq('id', id)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'reject') {
      if (!String(reject_reason || '').trim()) {
        return NextResponse.json({ success: false, error: '請填寫退回原因' }, { status: 400 })
      }
      const { error } = await supabaseAdmin.from('companions').update({
        status: 'pending', reviewed_at: now, reviewed_by: auth.admin.name,
        reject_reason, profile_submitted_at: null,
      }).eq('id', id)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: '參數錯誤' }, { status: 400 })
  } catch {
    return NextResponse.json({ success: false, error: '操作失敗' }, { status: 500 })
  }
}
