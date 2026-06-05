import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/by-order-no/{orderNo}
 * Fetch a single order's summary by its order number.
 * Used by the order-success page to display items + total after checkout.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderNo: string } }
) {
  const orderNo = params.orderNo?.trim()
  if (!orderNo) {
    return NextResponse.json({ success: false, error: '訂單編號錯誤' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      order_no, order_status, customer_name, phone, line_id,
      total_amount, items_count, store_name, store_address,
      county, district, note, created_at,
      order_items(id, product_name_snapshot, product_image_snapshot,
                  variant_name_snapshot, unit_price, quantity, subtotal)
    `)
    .eq('order_no', orderNo)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
  }

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
