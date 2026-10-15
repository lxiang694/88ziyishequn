import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import {
  checkoutProblem, enabledMethods, friendlyOrderError, generateGroupBuyOrderNo, type CheckoutInput,
} from '@/lib/groupBuy/domain'

/**
 * POST /api/group-buy/orders —— 團購下單（與一般購物車分開結帳）。
 *
 * 前台只送「哪個商品、幾件」與收件資料；價格、運費、限量、限購、開團時間
 * 全部由資料庫的 place_group_buy_order 在同一個交易裡重新檢查與計算。
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    const raw = await req.text()
    if (raw.length > 20_000) return NextResponse.json({ success: false, error: '資料過大' }, { status: 400 })
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 })
  }

  const slug = typeof body?.slug === 'string' ? body.slug : ''
  const { data: campaign } = await supabaseAdmin.from('group_buy_campaigns')
    .select('slug, ship_711_enabled, ship_home_enabled').eq('slug', slug).eq('is_published', true).maybeSingle()
  if (!campaign) return NextResponse.json({ success: false, error: '團購不存在' }, { status: 404 })

  const input: CheckoutInput = {
    customer_name: String(body.customer_name || ''),
    phone: String(body.phone || '').replace(/[\s-]/g, ''),
    shipping_method: body.shipping_method,
    store_id: body.store_id == null ? null : Number(body.store_id),
    home_address: String(body.home_address || ''),
    delivery_time: body.delivery_time ? String(body.delivery_time) : undefined,
    note: String(body.note || ''),
    items: Array.isArray(body.items) ? body.items.map((i: any) => ({ item_id: Number(i?.item_id), quantity: Number(i?.quantity) })) : [],
  }
  const problem = checkoutProblem(input, enabledMethods(campaign as any))
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })

  // 單號是亂數，極少數撞號時換一個再試
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAdmin.rpc('place_group_buy_order', {
      p_order_no: generateGroupBuyOrderNo(),
      p_campaign_slug: slug,
      p_customer_name: input.customer_name.trim(),
      p_phone: input.phone,
      p_shipping_method: input.shipping_method,
      p_store_id: input.shipping_method === '711' ? input.store_id : null,
      p_home_address: input.shipping_method === 'home' ? input.home_address!.trim() : null,
      p_delivery_time: input.shipping_method === 'home' ? (input.delivery_time || '不指定') : null,
      p_note: (input.note || '').trim(),
      p_items: input.items,
    })
    if (error) {
      if (error.code === '23505' && attempt < 2) continue
      console.error('[group-buy] place order failed', { code: error.code, message: error.message })
      return NextResponse.json({ success: false, error: friendlyOrderError(error.message) }, { status: 400 })
    }
    // 讓團購頁的已售數量與跟團人數盡快更新
    try { revalidatePath(`/group-buy/${slug}`) } catch {}
    return NextResponse.json({ success: true, data })
  }
  return NextResponse.json({ success: false, error: '下單失敗，請稍後再試' }, { status: 500 })
}
