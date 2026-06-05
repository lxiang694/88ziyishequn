import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateOrderNo, validateTWPhone } from '@/lib/utils'
import { getUserFromRequest } from '@/lib/userAuth'

// POST /api/orders - place order atomically
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customer_name, phone, line_id, store_id, store_name, store_address,
            county, district, note, items } = body

    // Optionally identify logged-in user (no fail if not authed — guest checkout still works)
    const authedUser = await getUserFromRequest(req)

    if (!customer_name?.trim()) return NextResponse.json({ success: false, error: '請填寫姓名' }, { status: 400 })
    if (!phone || !validateTWPhone(phone)) return NextResponse.json({ success: false, error: '請填寫正確的手機號碼（09xxxxxxxx）' }, { status: 400 })
    if (!store_id || !store_name) return NextResponse.json({ success: false, error: '請選擇 7-11 門市' }, { status: 400 })
    if (!items || items.length === 0) return NextResponse.json({ success: false, error: '購物車是空的' }, { status: 400 })

    // Validate items have required fields
    for (const item of items) {
      if (!item.variant_id || !item.product_id || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ success: false, error: '訂單資料格式錯誤' }, { status: 400 })
      }
    }

    const order_no = generateOrderNo()

    // Use atomic RPC function to place order and deduct stock atomically
    const { data, error } = await supabaseAdmin.rpc('place_order', {
      p_order_no: order_no,
      p_customer_name: customer_name.trim(),
      p_phone: phone.trim(),
      p_line_id: line_id?.trim() || null,
      p_store_id: store_id,
      p_store_name: store_name,
      p_store_address: store_address,
      p_county: county || '',
      p_district: district || '',
      p_note: note?.trim() || null,
      p_items: items.map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        cover_image_url: i.cover_image_url || null,
        variant_id: i.variant_id,
        variant_name: i.variant_name,
        sku_code: i.sku_code || null,
        unit_price: i.unit_price,
        quantity: i.quantity,
      })),
    })

    if (error) {
      console.error('RPC place_order error:', error)
      const msg = error.message || ''
      if (msg.includes('庫存不足')) return NextResponse.json({ success: false, error: msg }, { status: 400 })
      if (msg.includes('庫存扣減失敗')) return NextResponse.json({ success: false, error: '商品已被搶購，請重新下單' }, { status: 409 })
      return NextResponse.json({ success: false, error: '下單失敗，請稍後再試' }, { status: 500 })
    }

    const result = data as any

    // If user is logged in, link this order + update default profile fields
    if (authedUser) {
      // Link order
      await supabaseAdmin
        .from('orders')
        .update({ user_id: authedUser.id })
        .eq('id', result.order_id)

      // Update profile: name, phone, line_id, default store (only fill missing fields)
      const { data: prof } = await supabaseAdmin
        .from('user_profiles')
        .select('name, phone, line_id, default_store_id')
        .eq('id', authedUser.id)
        .maybeSingle()

      const profileUpdate: any = {}
      if (!prof?.name && customer_name?.trim()) profileUpdate.name = customer_name.trim()
      if (!prof?.phone && phone?.trim()) profileUpdate.phone = phone.trim()
      if (!prof?.line_id && line_id?.trim()) profileUpdate.line_id = line_id.trim()
      if (!prof?.default_store_id && store_id) {
        profileUpdate.default_store_id = store_id
        profileUpdate.default_store_name = store_name
        profileUpdate.default_store_address = store_address
        profileUpdate.default_store_county = county
        profileUpdate.default_store_district = district
      }
      if (Object.keys(profileUpdate).length > 0) {
        await supabaseAdmin
          .from('user_profiles')
          .update(profileUpdate)
          .eq('id', authedUser.id)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        order_no: result.order_no,
        order_id: result.order_id,
        total_amount: result.total_amount,
        items_count: result.items_count,
      },
    })
  } catch (err) {
    console.error('Place order error:', err)
    return NextResponse.json({ success: false, error: '系統錯誤，請稍後再試' }, { status: 500 })
  }
}

// GET /api/orders?phone=09xxxxxxxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone') || ''
  if (!phone || !validateTWPhone(phone)) {
    return NextResponse.json({ success: false, error: '請輸入正確的手機號碼' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('phone', phone.trim())
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [] })
}
