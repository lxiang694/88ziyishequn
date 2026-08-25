import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

function canAccess(perms: string[]) {
  return perms.includes('all') || perms.includes('care.view')
}

/** 後台：陪診預約列表 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!canAccess(auth.admin.permissions)) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''

  let q = supabaseAdmin
    .from('care_bookings')
    .select('*, companions(id, name, phone)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (status) q = q.eq('status', status)
  if (search) q = q.or(`booking_no.ilike.%${search}%,patient_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%`)

  const { data, error } = await q
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ success: true, data: [], table_missing: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data: data || [] })
}

/** 後台：更新狀態／派工／備註 */
export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!canAccess(auth.admin.permissions)) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, status, companion_id, admin_note } = body
    if (!id) return NextResponse.json({ success: false, error: '缺少預約 id' }, { status: 400 })

    const update: any = { updated_at: new Date().toISOString() }
    if (status !== undefined) update.status = status
    if (companion_id !== undefined) update.companion_id = companion_id || null
    if (admin_note !== undefined) update.admin_note = admin_note

    // 接送資訊與加購費用（客服與客戶確認後填寫）
    for (const f of ['pickup_address', 'pickup_time', 'pickup_note']) {
      if (body[f] !== undefined) update[f] = body[f] || null
    }
    for (const f of ['addon_fee', 'addon_companion_fee']) {
      if (body[f] !== undefined) update[f] = Number(body[f]) || 0
    }

    // 指派陪診員時，若仍在前段流程，自動推進為「已派工」
    if (companion_id && status === undefined) update.status = '已派工'

    const { error } = await supabaseAdmin.from('care_bookings').update(update).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}
