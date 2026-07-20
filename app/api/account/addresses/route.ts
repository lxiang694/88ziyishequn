import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { validateTWPhone } from '@/lib/utils'

const MAX_ADDRESSES = 10

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  const { data, error } = await supabaseAdmin
    .from('saved_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  try {
    const body = await req.json()
    const { label, recipient_name, phone, line_id, store_id, store_name, store_address, store_county, store_district, is_default } = body

    if (!recipient_name?.trim()) return NextResponse.json({ success: false, error: '請填寫姓名' }, { status: 400 })
    if (!phone || !validateTWPhone(phone)) return NextResponse.json({ success: false, error: '手機號碼格式錯誤' }, { status: 400 })
    if (!store_id || !store_name) return NextResponse.json({ success: false, error: '請選擇門市' }, { status: 400 })

    // Skip if an identical entry already exists (recipient + phone + store)
    const { data: existing } = await supabaseAdmin
      .from('saved_addresses')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone', phone.trim())
      .eq('store_id', store_id)
      .eq('recipient_name', recipient_name.trim())
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: true, data: existing, message: '已存在相同的常用收件資訊' })
    }

    const { count } = await supabaseAdmin
      .from('saved_addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count || 0) >= MAX_ADDRESSES) {
      return NextResponse.json({ success: false, error: `最多只能儲存 ${MAX_ADDRESSES} 筆常用收件資訊` }, { status: 400 })
    }

    if (is_default) {
      await supabaseAdmin.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id)
    }

    const { data, error } = await supabaseAdmin
      .from('saved_addresses')
      .insert({
        user_id: user.id,
        label: label?.trim() || null,
        recipient_name: recipient_name.trim(),
        phone: phone.trim(),
        line_id: line_id?.trim() || null,
        store_id,
        store_name,
        store_address: store_address || '',
        store_county: store_county || '',
        store_district: store_district || '',
        is_default: !!is_default,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '儲存失敗' }, { status: 500 })
  }
}
