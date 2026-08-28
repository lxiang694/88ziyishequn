import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

/**
 * 單一會員的訂單明細（後台展開用）。
 *
 * 比對規則刻意與 /api/account/orders 完全一致，
 * 這樣後台看到的筆數與內容，就等於會員自己在「我的訂單」看到的。
 * 僅限超級管理員 —— 訂單含收件人姓名與手機。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth

  const userId = params.id?.trim()
  // 只接受 UUID：避免把任意字串拼進查詢條件
  if (!/^[0-9a-f-]{36}$/i.test(userId || '')) {
    return NextResponse.json({ success: false, error: '會員編號格式錯誤' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle()

  let query = supabaseAdmin
    .from('orders')
    .select('id, order_no, user_id, customer_name, phone, store_name, county, district, order_status, items_count, total_amount, created_at, order_items(id, product_name_snapshot, variant_name_snapshot, unit_price, quantity, subtotal)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (profile?.phone) {
    // user_id 是唯一可靠的歸屬依據；手機比對只用來撈入會前的訪客單
    query = query.or(`user_id.eq.${userId},and(user_id.is.null,phone.eq.${profile.phone})`)
  } else {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
  if (error) {
    console.error('[admin/members/orders]', error.message)
    return NextResponse.json({ success: false, error: '讀取訂單失敗' }, { status: 500 })
  }

  const orders = (data || []).map(o => ({
    ...o,
    // 讓後台看得出這筆是正式歸屬，還是靠手機比對撈到的舊訪客單
    is_linked: !!o.user_id,
  }))

  return NextResponse.json(
    { success: true, data: orders },
    { headers: { 'Cache-Control': 'no-store' } })
}
