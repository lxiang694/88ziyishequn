import { supabaseAdmin } from '@/lib/supabase'
import { getSalesCountForProduct } from '@/lib/salesUtils'
import { rankProductArticles } from '@/lib/productArticleMatcher'

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
  data.sales_count = await getSalesCountForProduct(data.id)

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
