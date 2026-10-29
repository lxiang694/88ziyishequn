import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLIC_ORDER_COLUMNS } from '@/lib/orderSecurity'
import { loadShipGroups } from '@/lib/shipPackagesRepo'

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
  if (!orderNo || !/^TW\d{14}$/.test(orderNo)) {
    return NextResponse.json({ success: false, error: '訂單編號錯誤' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    // 只回下單成功頁需要的欄位：不含姓名、手機、LINE、備註（訂單編號可以被猜）
    .select(PUBLIC_ORDER_COLUMNS)
    .eq('order_no', orderNo)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
  }

  // 現貨＋預購分兩包寄：下單成功頁要告訴客人每包各付多少
  const variantIds = ((data as any).order_items || []).map((i: any) => i.variant_id).filter(Boolean)
  const ship_groups = await loadShipGroups(variantIds).catch(() => ({}))

  return NextResponse.json(
    { success: true, data: { ...(data as any), ship_groups } },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
