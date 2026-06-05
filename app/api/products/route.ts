import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSalesMap } from '@/lib/salesUtils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const limit = parseInt(searchParams.get('limit') || '200')

  // 若有分類篩選，先取對應的 product_id 清單
  let productIdFilter: number[] | null = null
  if (category) {
    const { data: relations } = await supabaseAdmin
      .from('product_category_relations')
      .select('product_id, health_categories!inner(slug)')
      .eq('health_categories.slug', category)
    productIdFilter = (relations || []).map((r: any) => r.product_id)
    if (productIdFilter.length === 0) {
      return NextResponse.json({ success: true, data: [], total: 0 })
    }
  }

  // 商品查詢與銷量查詢平行執行
  let productQuery = supabaseAdmin
    .from('products')
    .select(`
      id, product_name, slug, short_intro, cover_image_url,
      product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active),
      product_category_relations(health_categories(id, name, slug))
    `, { count: 'exact' })
    .eq('is_published', true)
    .limit(limit)

  if (search) {
    // 拆分中文組與英文數字組，逐一 AND 比對，支援「維C」→「維生素C」模糊搜尋
    const tokens = search.trim().match(/[一-鿿]+|[a-zA-Z0-9]+/g) || [search.trim()]
    for (const token of tokens) {
      productQuery = productQuery.ilike('product_name', `%${token}%`)
    }
  }
  if (productIdFilter !== null) productQuery = productQuery.in('id', productIdFilter)

  const [{ data, error, count }, salesMap] = await Promise.all([
    productQuery,
    buildSalesMap(),  // already excludes cancelled orders
  ])

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // 把銷量直接附加到每件商品上
  const withSales = (data || []).map((p: any) => ({
    ...p,
    sales_count: salesMap[p.id] || 0,
  }))

  const sorted = withSales.sort(
    (a: any, b: any) => (b.sales_count || 0) - (a.sales_count || 0)
  )

  return NextResponse.json(
    { success: true, data: sorted, total: count || 0 },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
