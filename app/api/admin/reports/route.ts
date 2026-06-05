import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

// Helper: get Taiwan timezone date range as UTC timestamps for Supabase
function getTWDateRange(dateRange: string, startDate: string, endDate: string): { start: string; end: string } {
  // Taiwan is UTC+8
  const TW_OFFSET = 8 * 60 * 60 * 1000

  const nowUTC = Date.now()
  const nowTW = new Date(nowUTC + TW_OFFSET)
  const todayTW = nowTW.toISOString().slice(0, 10) // YYYY-MM-DD in TW time

  function twDayToUTC(dateStr: string, isEnd: boolean): string {
    // dateStr is YYYY-MM-DD in Taiwan time
    // Convert to UTC: subtract 8 hours from TW midnight
    const time = isEnd ? 'T23:59:59' : 'T00:00:00'
    // TW midnight = UTC-8h = previous day 16:00 UTC
    const twDate = new Date(dateStr + time + '+08:00')
    return twDate.toISOString()
  }

  switch (dateRange) {
    case 'today':
      return { start: twDayToUTC(todayTW, false), end: twDayToUTC(todayTW, true) }
    case 'yesterday': {
      const yd = new Date(nowTW)
      yd.setDate(yd.getDate() - 1)
      const ydStr = yd.toISOString().slice(0, 10)
      return { start: twDayToUTC(ydStr, false), end: twDayToUTC(ydStr, true) }
    }
    case '3days': {
      const d3 = new Date(nowTW)
      d3.setDate(d3.getDate() - 2)
      const d3Str = d3.toISOString().slice(0, 10)
      return { start: twDayToUTC(d3Str, false), end: twDayToUTC(todayTW, true) }
    }
    case 'month': {
      const monthStart = todayTW.slice(0, 7) + '-01'
      return { start: twDayToUTC(monthStart, false), end: twDayToUTC(todayTW, true) }
    }
    case 'custom':
      if (startDate && endDate) {
        return { start: twDayToUTC(startDate, false), end: twDayToUTC(endDate, true) }
      }
      return { start: twDayToUTC(todayTW, false), end: twDayToUTC(todayTW, true) }
    default:
      return { start: twDayToUTC(todayTW, false), end: twDayToUTC(todayTW, true) }
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  // Only super_admin and customer_service can see full reports
  // shipper and product_manager cannot access reports
  const canViewReports = admin.permissions.includes('all') ||
    admin.role_key === 'customer_service'

  if (!canViewReports) {
    return NextResponse.json({ success: false, error: '無權限查看報表' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateRange = searchParams.get('dateRange') || 'today'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''

  const { start, end } = getTWDateRange(dateRange, startDate, endDate)

  // Fetch non-cancelled orders in range
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, order_status, total_amount, items_count')
    .gte('created_at', start)
    .lte('created_at', end)
    .neq('order_status', '已取消')

  if (ordersError) return NextResponse.json({ success: false, error: ordersError.message }, { status: 500 })

  const orderIds = (orders || []).map((o: any) => o.id)

  // All orders including cancelled for status stats
  const { data: allOrders } = await supabaseAdmin
    .from('orders')
    .select('order_status')
    .gte('created_at', start)
    .lte('created_at', end)

  const statusMap = new Map<string, number>()
  for (const o of allOrders || []) {
    statusMap.set(o.order_status, (statusMap.get(o.order_status) || 0) + 1)
  }
  const status_stats = Array.from(statusMap.entries())
    .map(([order_status, count]) => ({ order_status, count }))
    .sort((a, b) => b.count - a.count)

  const summary = {
    total_orders: orders?.length || 0,
    total_items: orders?.reduce((s: number, o: any) => s + (o.items_count || 0), 0) || 0,
    total_revenue: orders?.reduce((s: number, o: any) => s + parseFloat(o.total_amount || 0), 0) || 0,
  }

  if (orderIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: { summary, status_stats, product_stats: [], variant_stats: [], category_stats: [] },
    })
  }

  // Get order items
  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .in('order_id', orderIds)

  // Product stats
  const productMap = new Map<number, any>()
  for (const item of items || []) {
    if (!item.product_id) continue
    if (!productMap.has(item.product_id)) {
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_name: item.product_name_snapshot,
        total_qty: 0, total_revenue: 0,
      })
    }
    const p = productMap.get(item.product_id)
    p.total_qty += item.quantity
    p.total_revenue += parseFloat(item.subtotal)
  }
  const product_stats = Array.from(productMap.values()).sort((a, b) => b.total_qty - a.total_qty)

  // Variant stats
  const variantMap = new Map<number, any>()
  for (const item of items || []) {
    if (!item.variant_id) continue
    if (!variantMap.has(item.variant_id)) {
      variantMap.set(item.variant_id, {
        variant_id: item.variant_id,
        product_name: item.product_name_snapshot,
        variant_name: item.variant_name_snapshot,
        sku_code: item.sku_snapshot,
        total_qty: 0, total_revenue: 0,
      })
    }
    const v = variantMap.get(item.variant_id)
    v.total_qty += item.quantity
    v.total_revenue += parseFloat(item.subtotal)
  }
  const variant_stats = Array.from(variantMap.values()).sort((a, b) => b.total_qty - a.total_qty)

  // Category stats (one product can belong to multiple categories - counted in each)
  const productIds = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))]
  let category_stats: any[] = []

  if (productIds.length > 0) {
    const { data: catRelations } = await supabaseAdmin
      .from('product_category_relations')
      .select('product_id, health_categories(id, name)')
      .in('product_id', productIds)

    const catMap = new Map<string, any>()
    for (const rel of catRelations || []) {
      const catName = (rel as any).health_categories?.name
      if (!catName) continue
      if (!catMap.has(catName)) {
        catMap.set(catName, { category_name: catName, total_qty: 0, total_revenue: 0 })
      }
      const productItems = (items || []).filter((i: any) => i.product_id === (rel as any).product_id)
      for (const pi of productItems) {
        catMap.get(catName).total_qty += pi.quantity
        catMap.get(catName).total_revenue += parseFloat(pi.subtotal)
      }
    }
    category_stats = Array.from(catMap.values()).sort((a, b) => b.total_revenue - a.total_revenue)
  }

  return NextResponse.json({
    success: true,
    data: { summary, status_stats, product_stats, variant_stats, category_stats },
  })
}
