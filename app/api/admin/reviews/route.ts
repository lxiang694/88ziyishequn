import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'

export const dynamic = 'force-dynamic'
const PAGE = 30

/** 後台：評價列表（新的在前），可依狀態、星數篩選 */
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'products.all')
  if (auth instanceof NextResponse) return auth
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page')) || 1)
  let query = supabaseAdmin.from('product_reviews')
    .select('id, product_id, display_name, rating, content, tags, variant_name, verified_purchase, status, admin_reply, admin_reply_at, created_at, updated_at, products(product_name, slug, cover_image_url)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
  const status = sp.get('status')
  if (status === 'published' || status === 'hidden') query = query.eq('status', status)
  const rating = Number(sp.get('rating'))
  if (rating >= 1 && rating <= 5) query = query.eq('rating', rating)
  if (sp.get('unreplied') === '1') query = query.is('admin_reply', null)
  if (sp.get('low') === '1') query = query.lte('rating', 2)
  const { data, error, count } = await query
  if (error) return NextResponse.json({ success: true, ready: false, data: [], total: 0, pageSize: PAGE })
  return NextResponse.json({ success: true, ready: true, data: data || [], total: count || 0, pageSize: PAGE })
}
