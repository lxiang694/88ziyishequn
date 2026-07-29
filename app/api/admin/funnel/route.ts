import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { getTWDateRange } from '@/lib/adminDateRange'

export const runtime = 'nodejs'

const BATCH = 1000
const MAX_ROWS = 200000

// 批次抓取某表在時間範圍內的欄位；表不存在（42P01）時回傳 null 代表「無此資料源」
async function fetchRange(
  table: string,
  columns: string,
  start: string,
  end: string,
  applyFilter?: (q: any) => any,
): Promise<any[] | null> {
  const rows: any[] = []
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    let q = supabaseAdmin
      .from(table)
      .select(columns)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .range(from, from + BATCH - 1)
    if (applyFilter) q = applyFilter(q)
    const { data, error } = await q
    if (error) {
      if (error.code === '42P01') return null // 表尚未建立
      throw new Error(error.message)
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < BATCH) break
  }
  return rows
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('orders.view')) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateRange = searchParams.get('dateRange') || '7days'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const { start, end } = getTWDateRange(dateRange, startDate, endDate)

  try {
    // 商品瀏覽 / 進入結帳：來自 page_views
    const productViews = await fetchRange('page_views', 'visitor_id', start, end, q => q.like('path', '/products/%'))
    const checkoutViews = await fetchRange('page_views', 'visitor_id', start, end, q => q.eq('path', '/checkout'))
    // 加入購物車 / 送出 / 失敗：來自 funnel_events（盡力而為的前端埋點）
    const events = await fetchRange('funnel_events', 'event, visitor_id, meta', start, end)

    // 下單成功：直接數真實訂單表（唯一可信來源，排除已取消），確保與實際訂單一致
    let orderCount = 0
    {
      const { count, error } = await supabaseAdmin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end)
        .neq('order_status', '已取消')
      if (error && error.code !== '42P01') throw new Error(error.message)
      orderCount = count || 0
    }

    const distinct = (rows: any[] | null) => {
      const s = new Set<string>()
      for (const r of rows || []) if (r.visitor_id) s.add(r.visitor_id)
      return s.size
    }

    // funnel_events 分事件的不重複訪客
    const setByEvent: Record<string, Set<string>> = {}
    const failReasons: Record<string, number> = {}
    for (const r of events || []) {
      const ev = r.event as string
      if (!setByEvent[ev]) setByEvent[ev] = new Set()
      if (r.visitor_id) setByEvent[ev].add(r.visitor_id)
      if (ev === 'submit_fail') {
        const reason = (r.meta && (r.meta.reason as string)) || 'unknown'
        failReasons[reason] = (failReasons[reason] || 0) + 1
      }
    }
    const evCount = (ev: string) => (setByEvent[ev] ? setByEvent[ev].size : 0)

    const stages = [
      { key: 'view_product', label: '瀏覽商品', visitors: distinct(productViews) },
      { key: 'add_to_cart', label: '加入購物車', visitors: evCount('add_to_cart') },
      { key: 'checkout_start', label: '進入結帳', visitors: distinct(checkoutViews) },
      { key: 'submit_click', label: '點擊送出', visitors: evCount('submit_click') },
      { key: 'order_success', label: '下單成功', visitors: orderCount, fromOrders: true },
    ]

    const REASON_LABELS: Record<string, string> = {
      customer_name: '姓名未填', phone: '手機號碼有誤', store: '未選門市',
      empty_cart: '購物車為空', api: '系統/庫存錯誤', network: '網路錯誤', unknown: '其他',
    }
    const fails = Object.entries(failReasons)
      .map(([reason, count]) => ({ reason, label: REASON_LABELS[reason] || reason, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      data: {
        stages,
        fails,
        funnel_table_missing: events === null,
        range: { start, end },
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '查詢失敗' }, { status: 500 })
  }
}
