import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeGroupBuy } from '@/lib/groupBuy/adminAuth'
import { summarizeGroupBuy, type DashOrderRow } from '@/lib/groupBuy/dashboard'

export const dynamic = 'force-dynamic'

/**
 * 儀表板的團購摘要：需要注意的檔期（開團中、預告、還有待出貨的）與最新 5 筆團購訂單。
 * 沒有團購權限回 403，儀表板就不顯示這一區。
 */
export async function GET(req: NextRequest) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth

  const { data: campaigns, error } = await supabaseAdmin.from('group_buy_campaigns')
    .select('id, slug, title, starts_at, ends_at, is_published').order('starts_at', { ascending: false }).limit(200)
  // 團購資料表還沒建立：當成沒有團購
  if (error) return NextResponse.json({ success: true, data: { campaigns: [], pendingTotal: 0, todayTotal: 0, recent: [] } })

  // 只統計需要的檔期：開啟中的，加上還有待出貨訂單的
  const { data: pendingRows } = await supabaseAdmin.from('group_buy_orders').select('campaign_id').eq('status', '待出貨').limit(5000)
  const ids = Array.from(new Set([
    ...(campaigns || []).filter(c => c.is_published).map(c => c.id),
    ...(pendingRows || []).map(r => r.campaign_id),
  ]))

  const orders: DashOrderRow[] = []
  if (ids.length) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabaseAdmin.from('group_buy_orders')
        .select('campaign_id, total_amount, status, created_at').in('campaign_id', ids).neq('status', '已取消')
        .order('id').range(from, from + 999)
      orders.push(...(data || []))
      if (!data || data.length < 1000) break
    }
  }

  const { data: recentRows } = await supabaseAdmin.from('group_buy_orders')
    .select('id, order_no, campaign_id, customer_name, total_amount, status, shipping_method, created_at')
    .order('created_at', { ascending: false }).limit(5)
  const titles = new Map((campaigns || []).map(c => [c.id, c.title]))
  const recent = (recentRows || []).map(o => ({ ...o, campaign_title: titles.get(o.campaign_id) || '' }))

  return NextResponse.json(
    { success: true, data: { ...summarizeGroupBuy(campaigns || [], orders), recent } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
