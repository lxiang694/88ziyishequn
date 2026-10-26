import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/userAuth'
import { fetchReviews, fetchReviewSummary } from '@/lib/reviewRepo'
import { maskName, validateReview } from '@/lib/reviews'
import { findPurchase } from '@/lib/reviewPurchase'
import { refreshStorefront } from '@/lib/storefrontCache'

export const dynamic = 'force-dynamic'

const productIdOf = (v: unknown) => {
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** 公開：某商品的評價摘要與列表（可依星數、已購買篩選，分頁） */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const productId = productIdOf(sp.get('product_id'))
  if (!productId) return NextResponse.json({ success: false, error: '商品編號錯誤' }, { status: 400 })
  const rating = Number(sp.get('rating')) || undefined
  const offset = Math.max(0, Math.min(10_000, Number(sp.get('offset')) || 0))
  const [{ ready, summary }, list] = await Promise.all([
    fetchReviewSummary(supabaseAdmin, productId),
    fetchReviews(supabaseAdmin, productId, { rating, verified: sp.get('verified') === '1', offset }),
  ])
  return NextResponse.json({ success: true, ready, summary, ...list }, { headers: { 'Cache-Control': 'no-store' } })
}

/** 會員：寫評價或修改自己的評價（一個商品一則） */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { user } = auth

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  const productId = productIdOf(body?.product_id)
  if (!productId) return NextResponse.json({ success: false, error: '商品編號錯誤' }, { status: 400 })
  const checked = validateReview(body)
  if (!checked.ok) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })

  const { data: product } = await supabaseAdmin.from('products').select('id').eq('id', productId).eq('is_published', true).maybeSingle()
  if (!product) return NextResponse.json({ success: false, error: '商品不存在或已下架' }, { status: 404 })

  const [{ data: profile }, purchase] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('name, phone').eq('id', user.id).maybeSingle(),
    findPurchase(user.id, productId),
  ])

  const row = {
    rating: checked.value.rating,
    content: checked.value.content,
    tags: checked.value.tags,
    display_name: maskName(profile?.name, user.email),
    verified_purchase: !!purchase,
    variant_name: purchase?.variant_name || null,
    updated_at: new Date().toISOString(),
  }
  const { data: existing, error: findErr } = await supabaseAdmin.from('product_reviews')
    .select('id').eq('product_id', productId).eq('user_id', user.id).maybeSingle()
  if (findErr) return NextResponse.json({ success: false, error: '評價功能尚未啟用，請稍後再試' }, { status: 503 })

  const { error } = existing
    ? await supabaseAdmin.from('product_reviews').update(row).eq('id', existing.id)
    : await supabaseAdmin.from('product_reviews').insert({ ...row, product_id: productId, user_id: user.id })
  if (error) return NextResponse.json({ success: false, error: '評價送出失敗，請稍後再試' }, { status: 500 })

  refreshStorefront()
  return NextResponse.json({ success: true, updated: !!existing, message: existing ? '評價已更新' : '感謝您的評價！' })
}
