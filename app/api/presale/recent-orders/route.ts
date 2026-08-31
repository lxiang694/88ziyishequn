import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PRESALE } from '@/lib/presale/camelliaOil'
import { toPublicRecentOrder, isRecentEnough } from '@/lib/presale/maskIdentity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_ITEMS = 8

/**
 * 預售商品的近期訂購紀錄（公開，已去識別化）。
 *
 * ⚠️ 這個端點回傳的是**真實訂單**，只是姓名與電話經過遮罩。
 *    絕不可改成產生假資料 —— 假的購買訊息在台灣是
 *    《公平交易法》第 21 條的不實廣告。沒有訂單就回空陣列，
 *    前端會整個區塊不顯示。
 *
 * 回傳欄位只有 name / phone / when 三個字串，
 * 沒有訂單編號、金額、門市、地址，也沒有任何可回查的 id。
 */
export async function GET() {
  try {
    // 1. 找出這個預售商品
    const { data: product } = await supabaseAdmin
      .from('products').select('id').eq('slug', PRESALE.productSlug).maybeSingle()
    if (!product) return NextResponse.json({ success: true, data: [] })

    // 2. 買過這個商品的訂單 id
    const { data: items } = await supabaseAdmin
      .from('order_items').select('order_id').eq('product_id', (product as any).id)
    const orderIds = Array.from(new Set(((items as any[]) || []).map(i => i.order_id)))
    if (orderIds.length === 0) return NextResponse.json({ success: true, data: [] })

    // 3. 取這些訂單的最小必要欄位；已取消的不算
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('customer_name, phone, created_at, order_status')
      .in('id', orderIds.slice(0, 200))
      .neq('order_status', '已取消')
      .order('created_at', { ascending: false })
      .limit(30)

    const now = new Date()
    const data = ((orders as any[]) || [])
      .filter(o => isRecentEnough(o.created_at, now))
      .slice(0, MAX_ITEMS)
      .map(o => toPublicRecentOrder(o, now))

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    // 這只是加分區塊，壞掉就當作沒有，不要影響商品頁
    return NextResponse.json({ success: true, data: [] })
  }
}
