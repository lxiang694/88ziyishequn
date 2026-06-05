import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSalesCountForProduct } from '@/lib/salesUtils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, sort_order, is_active),
      product_images(id, image_url, sort_order),
      product_category_relations(
        health_categories(id, name, slug)
      )
    `)
    .eq('slug', params.slug)
    .eq('is_published', true)
    .single()

  if (error) return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })

  // Sort variants and images
  if (data.product_variants) {
    data.product_variants.sort((a: any, b: any) => a.sort_order - b.sort_order)
  }
  if (data.product_images) {
    data.product_images.sort((a: any, b: any) => a.sort_order - b.sort_order)
  }

  // Attach sales count (excludes cancelled orders)
  data.sales_count = await getSalesCountForProduct(data.id)

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
