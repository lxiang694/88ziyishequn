import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeGroupBuy } from '@/lib/groupBuy/adminAuth'

export const dynamic = 'force-dynamic'

/** 這一檔的全部訂單（含明細）。匯總與匯出在畫面上用 supplierSummary 算，資料只抓一次 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  const id = Number(params.id)
  const { data: campaign } = await supabaseAdmin.from('group_buy_campaigns').select('id, slug, title, starts_at, ends_at').eq('id', id).maybeSingle()
  if (!campaign) return NextResponse.json({ success: false, error: '找不到檔期' }, { status: 404 })
  const orders: any[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabaseAdmin.from('group_buy_orders')
      .select('*, items:group_buy_order_items(item_id, name_snapshot, spec_snapshot, unit_price, quantity, subtotal)')
      .eq('campaign_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + 499)
    if (error) return NextResponse.json({ success: false, error: '讀取訂單失敗' }, { status: 500 })
    orders.push(...(data || []))
    if (!data || data.length < 500) break
  }
  return NextResponse.json({ success: true, data: { campaign, orders } })
}
