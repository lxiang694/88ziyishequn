import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { isSafePhone } from '@/lib/orderSecurity'
import { frequentVariants, reviewableProductIds, type MemberOrder } from '@/lib/memberOrders'

export const dynamic = 'force-dynamic'

/**
 * 會員中心：我的訂單（一般＋團購）、常買商品（再買一次）、待評價商品。
 *
 * 一般訂單：user_id 是唯一可靠的歸屬；手機比對只用來撈「入會前下的訪客單」，
 * 所以加上 user_id is null —— 否則只要有人把貨寄到這支手機，這個帳號就看得到別人的訂單。
 * 團購訂單沒有會員欄位，用會員資料裡的手機比對。
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  const { data: profile } = await supabaseAdmin.from('user_profiles').select('phone').eq('id', user.id).maybeSingle()
  const phone = isSafePhone(profile?.phone) ? profile!.phone : null

  let shopQuery = supabaseAdmin
    .from('orders')
    .select('id, order_no, customer_name, phone, store_name, county, district, order_status, items_count, total_amount, created_at, updated_at, order_items(id, product_id, variant_id, product_name_snapshot, product_image_snapshot, variant_name_snapshot, unit_price, quantity, subtotal)')
    .order('created_at', { ascending: false })
    .limit(50)
  // 只有格式正確的手機才放進查詢條件，舊資料裡的任意字串拼進 .or(...) 會被當成查詢語法
  shopQuery = phone ? shopQuery.or(`user_id.eq.${user.id},and(user_id.is.null,phone.eq.${phone})`) : shopQuery.eq('user_id', user.id)

  const [shop, gb, reviewed] = await Promise.all([
    shopQuery,
    phone
      ? supabaseAdmin.from('group_buy_orders')
        .select('id, order_no, phone, store_name, status, total_amount, created_at, campaign_id, group_buy_campaigns(title), group_buy_order_items(id, name_snapshot, spec_snapshot, quantity, subtotal)')
        .eq('phone', phone).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('product_reviews').select('product_id').eq('user_id', user.id),
  ])
  if (shop.error) return NextResponse.json({ success: false, error: '讀取訂單失敗' }, { status: 500 })

  const orders: MemberOrder[] = [
    ...(shop.data || []).map((o: any) => ({
      kind: 'shop' as const, id: o.id, order_no: o.order_no, status: o.order_status, created_at: o.created_at, updated_at: o.updated_at ?? null,
      total: o.total_amount, store_name: o.store_name, store_area: `${o.county || ''}${o.district || ''}`, phone: o.phone,
      items: (o.order_items || []).sort((a: any, b: any) => a.id - b.id).map((i: any) => ({
        name: i.product_name_snapshot, variant: i.variant_name_snapshot || '', quantity: i.quantity, subtotal: i.subtotal,
        image: i.product_image_snapshot || null, product_id: i.product_id ?? null, variant_id: i.variant_id ?? null,
      })),
    })),
    // 團購表還沒建時 gb.error 有值，當成沒有團購訂單
    ...((gb.error ? [] : gb.data) || []).map((o: any) => ({
      kind: 'group_buy' as const, id: o.id, order_no: o.order_no, status: o.status, created_at: o.created_at,
      total: o.total_amount, store_name: o.store_name, store_area: '', phone: o.phone,
      campaign_title: o.group_buy_campaigns?.title || '每月團購',
      items: (o.group_buy_order_items || []).sort((a: any, b: any) => a.id - b.id).map((i: any) => ({
        name: i.name_snapshot, variant: i.spec_snapshot || '', quantity: i.quantity, subtotal: i.subtotal,
        image: null, product_id: null, variant_id: null,
      })),
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  // 再買一次：常買的規格，帶目前的價格與庫存（下架、停售的不列）
  const freq = frequentVariants(orders)
  const reviewedIds = new Set<number>(((reviewed.error ? [] : reviewed.data) || []).map((r: any) => r.product_id))
  const toReview = reviewableProductIds(orders, reviewedIds).slice(0, 6)
  // 訂單裡出現過的商品，查目前的價格與庫存（再買一次要用現在的價格，不是當時的）
  const productIds = [...new Set([
    ...orders.flatMap(o => o.items.map(i => i.product_id)).filter((id): id is number => !!id),
    ...toReview,
  ])]
  const { data: products } = productIds.length
    ? await supabaseAdmin.from('products')
      .select('id, product_name, slug, cover_image_url, is_published, product_variants(id, variant_name, sale_price, stock_qty, sku_code, is_active)')
      .in('id', productIds)
    : { data: [] as any[] }
  const byId = new Map((products || []).map((p: any) => [p.id, p]))

  // catalog：variant_id → 目前可買的規格（下架、停售的不列）
  const catalog: Record<number, any> = {}
  for (const p of products || []) {
    if (!p.is_published) continue
    for (const v of p.product_variants || []) {
      if (!v.is_active) continue
      catalog[v.id] = {
        product_id: p.id, product_name: p.product_name, slug: p.slug, cover_image_url: p.cover_image_url,
        variant_id: v.id, variant_name: v.variant_name, sku_code: v.sku_code, sale_price: v.sale_price, stock_qty: v.stock_qty,
      }
    }
  }
  const rebuy = freq.flatMap(f => (catalog[f.variant_id] ? [{ ...catalog[f.variant_id], times: f.times }] : []))
  const reviewable = toReview.flatMap(id => {
    const p = byId.get(id)
    return p?.is_published ? [{ product_id: p.id, product_name: p.product_name, slug: p.slug, cover_image_url: p.cover_image_url }] : []
  })

  return NextResponse.json({ success: true, data: orders, rebuy, reviewable, catalog }, { headers: { 'Cache-Control': 'no-store' } })
}
