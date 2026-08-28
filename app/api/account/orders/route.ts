import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  // Get profile to find phone (for fallback matching)
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle()

  // Match orders by user_id OR by phone (catches old orders pre-membership)
  let query = supabaseAdmin
    .from('orders')
    .select('id, order_no, customer_name, phone, store_name, county, district, order_status, items_count, total_amount, created_at, order_items(id, product_name_snapshot, product_image_snapshot, variant_name_snapshot, unit_price, quantity, subtotal)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (profile?.phone) {
    // user_id 是唯一可靠的歸屬依據（收件人可以是別人）。
    // 手機比對只用來撈「入會前下的訪客單」，因此加上 user_id is null：
    // 否則只要有人把貨寄到這支手機，這個帳號就看得到那筆別人的訂單。
    query = query.or(
      `user_id.eq.${user.id},and(user_id.is.null,phone.eq.${profile.phone})`)
  } else {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json(
    { success: true, data: data || [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
