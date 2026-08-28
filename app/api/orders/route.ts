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
    let linkedToUser = false
    if (authedUser) {
      // 用 order_no 而不是 result.order_id：order_no 是我們自己產生的，
      // 一定存在且唯一；order_id 依賴 place_order RPC 的回傳格式，
      // 那個函式不在 repo 裡，欄位少一個就會靜默地更新 0 筆。
      //
      // 這個連結是「我的訂單」唯一可靠的依據 —— 收件人可以是別人
      // （幫家人代訂），所以不能靠手機號碼比對。連結失敗就等於
      // 這筆訂單永遠不會出現在會員的訂單列表裡，因此要驗證並重試。
      for (let attempt = 0; attempt < 2 && !linkedToUser; attempt++) {
        const { data: linked, error: linkErr } = await supabaseAdmin
          .from('orders')
          .update({ user_id: authedUser.id })
          .eq('order_no', order_no)
          .select('id')

        if (linkErr) {
          console.error('[orders] link user_id failed', { order_no, attempt, code: linkErr.code })
          continue
        }
        if (linked && linked.length > 0) linkedToUser = true
      }

      if (!linkedToUser) {
        // 訂單已經成立，不能因為連結失敗就讓下單失敗；
        // 但要留下明確紀錄，否則之後查不出來為什麼看不到這筆。
        console.error('[orders] order created but not linked to user', {
          order_no, user_id: authedUser.id,
        })
      }

      // Update profile: name, phone, line_id, default store (only fill missing fields)
      const { data: prof } = await supabaseAdmin
        .from('user_profiles')
        .select('name, phone, line_id, default_store_id')
        .eq('id', authedUser.id)
        .maybeSingle()

      const profileUpdate: any = {}
      // ⚠️ 刻意不從結帳表單回填 name 與 phone。
      //
      // 結帳表單填的是「收件人」，幫家人代訂時那不是會員本人。
      // 舊版會把收件人手機寫進會員的 user_profiles.phone，造成兩個問題：
      //   1. 會員的手機變成別人的
      //   2. /api/account/orders 會用這支手機去比對訂單，
      //      於是會員看得到「剛好寄給同一支手機」的其他人的訂單
      // 姓名與手機請會員在「個人資料」自行填寫。
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
