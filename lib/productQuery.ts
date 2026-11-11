// 只給前台頁面用，所以走會快取 60 秒的用戶端（見 lib/supabase.ts）
import { supabaseStorefront as supabaseAdmin } from '@/lib/supabase'
import { rankProductArticles } from '@/lib/productArticleMatcher'
import { buildSalesMap, getSalesCountForProduct } from '@/lib/salesUtils'
import { shopCategoriesByProduct } from '@/lib/shopCategoryRepo'
import { rankRecommendations, countCoBought, REC_COUNT } from '@/lib/productRecommend'

/**
 * 讀取一個已上架商品的完整資料（含規格、相簿、分類、銷量）。
 *
 * 伺服器端專用 —— 用的是 service_role，不可從元件直接呼叫。
 *
 * 抽出來的原因：商品頁原本只渲染 <ProductDetailClient slug={...} />，
 * 由瀏覽器自己去打 /api/products/[slug]。也就是伺服器回傳的 HTML
 * 只有一個骨架畫面，商品名稱、簡介、適合誰、成分說明全都不在裡面。
 *
 * 搜尋引擎雖然會執行 JavaScript，但那是額外的、延後的、而且不保證
 * 每次都做的工作。對一個剛開始做 SEO 的小站來說，把內容放進第一份
 * HTML 才是穩的。現在頁面先在伺服器查好、當成初始資料傳下去，
 * 元件的互動（選規格、加購物車）完全不受影響。
 */
export async function fetchPublishedProduct(slug: string) {
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
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error || !data) return null

  if (data.product_variants) {
    data.product_variants.sort((a: any, b: any) => a.sort_order - b.sort_order)
  }
  if (data.product_images) {
    data.product_images.sort((a: any, b: any) => a.sort_order - b.sort_order)
  }
  data.sales_count = await getSalesCountForProduct(data.id, supabaseAdmin)

  return data
}

/**
 * 找出跟這個商品相關的已上架文章。
 *
 * 一次撈全部已發布文章再在記憶體排序 —— 站上文章是數十篇的量級，
 * 而且比對要看標題與摘要的文字片段，那不是資料庫查詢擅長的事。
 * 文章數長到幾百篇時再改成先用分類縮小範圍。
 */
export async function fetchRelatedArticles(product: any, topN = 3) {
  if (!product?.product_name) return []

  const { data, error } = await supabaseAdmin
    .from('health_articles')
    .select('id, slug, title, excerpt, cover_image_url, category_slug, reading_minutes, view_count')
    .eq('is_published', true)
    .limit(200)

  if (error || !data) return []
  return rankProductArticles(data as any, product, topN)
}

/**
 * 商品頁底部「你可能也會喜歡」：6 件客人可能也想買的商品。
 *
 * 排序規則在 lib/productRecommend.ts（純函式，有測試）；這裡只負責
 * 把訊號查出來。任何一步查不到都只是少一個訊號、不會整區消失 ——
 * 最差也還有「同類＋熱銷」可以推。
 */
export async function fetchRecommendedProducts(product: any, n = REC_COUNT) {
  if (!product?.id) return []
  try {
    const [candRes, coBought, salesMap] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select(`id, product_name, slug, cover_image_url,
          product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, sort_order, is_active),
          product_category_relations(health_categories(id))`)
        .eq('is_published', true)
        .limit(300),
      fetchCoBought(product.id),
      buildSalesMap(supabaseAdmin),
    ])
    if (candRes.error || !candRes.data) return []
    const candidates = candRes.data as any[]

    // 同賣場分類
    const shopMap = await shopCategoriesByProduct([product.id, ...candidates.map(p => p.id)], supabaseAdmin)
    const myShop = new Set((shopMap.get(product.id) || []).map(c => c.id))
    const sameShop = new Set(candidates.filter(p => (shopMap.get(p.id) || []).some(c => myShop.has(c.id))).map(p => p.id))

    // 同健康訴求
    const healthIds = (p: any) => (p.product_category_relations || [])
      .map((r: any) => r.health_categories?.id).filter((x: any) => x != null)
    const myHealth = new Set(healthIds(product))
    const sameHealth = new Set(candidates.filter(p => healthIds(p).some((id: number) => myHealth.has(id))).map(p => p.id))

    return rankRecommendations(product.id, candidates, { coBought, sameShop, sameHealth, sales: salesMap }, n)
      .map(({ product: p, reason }) => {
        const { product_category_relations: _drop, ...rest } = p
        if (rest.product_variants) rest.product_variants.sort((a: any, b: any) => a.sort_order - b.sort_order)
        return { product: rest, reason }
      })
  } catch {
    return []
  }
}

/** 最近 300 張買過這件商品的訂單裡，其他商品各出現幾次 */
async function fetchCoBought(productId: number): Promise<Map<number, number>> {
  const { data: mine, error } = await supabaseAdmin
    .from('order_items')
    .select('order_id')
    .eq('product_id', productId)
    .order('id', { ascending: false })
    .limit(300)
  if (error || !mine?.length) return new Map()
  const orderIds = Array.from(new Set((mine as any[]).map(r => r.order_id)))
  const { data: rows, error: e2 } = await supabaseAdmin
    .from('order_items')
    .select('order_id, product_id')
    .in('order_id', orderIds)
    .limit(3000)
  if (e2 || !rows) return new Map()
  return countCoBought(productId, rows as any[])
}
