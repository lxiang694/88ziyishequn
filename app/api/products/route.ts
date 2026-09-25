import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSalesMap } from '@/lib/salesUtils'

export const dynamic = 'force-dynamic'

/** 商品 id → 它掛著的商品分類。資料表還沒建好時回空的 Map，不拋錯。 */
async function fetchShopCategories(productIds: number[]) {
  const out = new Map<number, { id: number; name: string; slug: string; emoji: string }[]>()
  if (productIds.length === 0) return out

  const { data, error } = await supabaseAdmin
    .from('product_shop_category_relations')
    .select('product_id, shop_categories(id, name, slug, emoji)')
    .in('product_id', productIds)
  if (error || !data) return out

  for (const row of data as any[]) {
    if (!row.shop_categories) continue
    const list = out.get(row.product_id) || []
    list.push(row.shop_categories)
    out.set(row.product_id, list)
  }
  return out
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  // 商品分類（逛街用）。與 category（健康訴求）是兩個不同的軸，
  // 兩個都給的話取交集，讓「心血管 ∩ 養身茶飲」這種查詢也成立。
  const shop = searchParams.get('shop') || ''
  const limit = parseInt(searchParams.get('limit') || '200')

  // 若有分類篩選，先各自取出符合的 product_id，最後取交集。
  // 兩個條件的清單先收在陣列裡再一起算，不用閉包去改外層變數 ——
  // 那樣寫型別推導會失效，讀的人也不容易看出最後到底套了哪些條件。
  const idSets: number[][] = []

  if (category) {
    const { data: relations } = await supabaseAdmin
      .from('product_category_relations')
      .select('product_id, health_categories!inner(slug)')
      .eq('health_categories.slug', category)
    idSets.push((relations || []).map((r: any) => Number(r.product_id)))
  }

  if (shop) {
    const { data: relations, error: shopError } = await supabaseAdmin
      .from('product_shop_category_relations')
      .select('product_id, shop_categories!inner(slug)')
      .eq('shop_categories.slug', shop)
    // 資料表還沒建好時不要把整個賣場變成空的 —— 跳過這個條件，
    // 讓客人至少看得到商品，總比一片空白好
    if (!shopError) idSets.push((relations || []).map((r: any) => Number(r.product_id)))
  }

  const productIdFilter: number[] | null = idSets.length === 0
    ? null
    : idSets.reduce((acc, ids) => acc.filter(id => ids.includes(id)))

  if (productIdFilter !== null && productIdFilter.length === 0) {
    return NextResponse.json({ success: true, data: [], total: 0 })
  }

  // 商品查詢與銷量查詢平行執行
  let productQuery = supabaseAdmin
    .from('products')
    .select(`*,
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

  // 商品分類是另外查再貼回去，不寫進上面的 select。
  // 寫進 select 的話，遷移還沒跑（資料表不存在）整個查詢會直接失敗，
  // 等於全站商品列表掛掉 —— 為了一塊顯示用的標籤不值得冒這個險。
  const shopByProduct = await fetchShopCategories((data || []).map((p: any) => p.id))

  // 把銷量直接附加到每件商品上
  const withSales = (data || []).map((p: any) => ({
    ...p,
    sales_count: salesMap[p.id] || 0,
    shop_categories: shopByProduct.get(p.id) || [],
  }))

  const sorted = withSales.sort(
    (a: any, b: any) => (b.sales_count || 0) - (a.sales_count || 0)
  )

  return NextResponse.json(
    { success: true, data: sorted, total: count || 0 },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
