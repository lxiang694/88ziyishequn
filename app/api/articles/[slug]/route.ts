import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { data: article, error } = await supabaseAdmin
    .from('health_articles')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error || !article) {
    return NextResponse.json({ success: false, error: '文章不存在' }, { status: 404 })
  }

  // increment view count (fire and forget)
  supabaseAdmin
    .from('health_articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', article.id)
    .then(() => {})

  // Find related products by category_slug
  let relatedProducts: any[] = []
  if (article.category_slug) {
    const { data: relations } = await supabaseAdmin
      .from('product_category_relations')
      .select('product_id, health_categories!inner(slug)')
      .eq('health_categories.slug', article.category_slug)
      .limit(20)
    const productIds = (relations || []).map((r: any) => r.product_id)

    if (productIds.length > 0) {
      const [{ data: products }, { data: salesData }] = await Promise.all([
        supabaseAdmin
          .from('products')
          .select(`
            id, product_name, slug, short_intro, cover_image_url,
            product_variants(id, sale_price, original_price, stock_qty, is_active)
          `)
          .eq('is_published', true)
          .in('id', productIds)
          .limit(6),
        supabaseAdmin.from('order_items').select('product_id, quantity'),
      ])

      const salesMap: Record<number, number> = {}
      for (const item of salesData || []) {
        salesMap[item.product_id] = (salesMap[item.product_id] || 0) + item.quantity
      }
      relatedProducts = (products || [])
        .sort((a: any, b: any) => (salesMap[b.id] || 0) - (salesMap[a.id] || 0))
        .slice(0, 3)
    }
  }

  return NextResponse.json(
    { success: true, data: { ...article, related_products: relatedProducts } },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
