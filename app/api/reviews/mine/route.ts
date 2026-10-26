import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { findPurchase } from '@/lib/reviewPurchase'

export const dynamic = 'force-dynamic'

/** 會員：自己對這個商品的評價（用來帶入修改），以及有沒有買過 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const productId = Number(new URL(req.url).searchParams.get('product_id'))
  if (!Number.isSafeInteger(productId) || productId <= 0) return NextResponse.json({ success: false, error: '商品編號錯誤' }, { status: 400 })
  const [{ data, error }, purchase] = await Promise.all([
    supabaseAdmin.from('product_reviews').select('id, rating, content, tags, status')
      .eq('product_id', productId).eq('user_id', auth.user.id).maybeSingle(),
    findPurchase(auth.user.id, productId),
  ])
  return NextResponse.json({
    success: true, ready: !error, review: data || null, purchased: !!purchase,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
