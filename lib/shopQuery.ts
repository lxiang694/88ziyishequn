import { supabaseAdmin } from '@/lib/supabase'
import { buildSalesMap } from '@/lib/salesUtils'
import { SHOP_CATEGORIES } from '@/lib/shopCategories'
import { shopCategoriesByProduct, type ShopCategoryRow } from '@/lib/shopCategoryRepo'

/**
 * 賣場頁的資料查詢。伺服器端專用。
 *
 * 分類頁要能被搜尋引擎收錄，所以商品必須在伺服器就查好、放進第一份
 * HTML。商品頁先前踩過這個坑：只送骨架下去、由瀏覽器再打 API，
 * 爬蟲看到的就只有一個空殼。
 */

export interface ShopCategoryView {
  id: number
  slug: string
  name: string
  emoji: string
  description: string
}

/**
 * 前台要顯示的分類清單。
 *
 * 資料表還沒建好時退回程式裡的那份清單 —— 分類是整個賣場的導覽骨架，
 * 寧可分類在、點進去是空的，也不要導覽整條消失。
 */
export async function fetchShopCategories(): Promise<ShopCategoryView[]> {
  const { data, error } = await supabaseAdmin
    .from('shop_categories')
    .select('id, slug, name, emoji, description, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error || !data?.length) {
    return SHOP_CATEGORIES.map((c, i) => ({
      id: -(i + 1), slug: c.slug, name: c.name, emoji: c.emoji, description: c.description,
    }))
  }
  return data as ShopCategoryView[]
}

/**
 * 某個分類（或全部）的已上架商品，依銷量排序。
 *
 * slug 為空字串時回傳全部商品 —— 還沒指派分類的商品也在裡面，所以
 * 不會有商品因為忘了分類就從賣場消失。
 */
export async function fetchShopProducts(slug: string, limit = 200) {
  let productIds: number[] | null = null

  if (slug) {
    const { data, error } = await supabaseAdmin
      .from('product_shop_category_relations')
      .select('product_id, shop_categories!inner(slug)')
      .eq('shop_categories.slug', slug)
    // 資料表還沒建好：這個分類就是空的，不是整站壞掉
    if (error) return []
    const ids = (data || []).map((r: any) => Number(r.product_id)).filter(Number.isInteger)
    if (ids.length === 0) return []
    productIds = ids
  }

  let query = supabaseAdmin
    .from('products')
    .select(`id, product_name, slug, short_intro, cover_image_url,
      product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active)`)
    .eq('is_published', true)
    .limit(limit)
  if (productIds !== null) query = query.in('id', productIds)

  const [{ data, error }, salesMap] = await Promise.all([query, buildSalesMap()])
  if (error || !data) return []

  const shopByProduct = await shopCategoriesByProduct(data.map((p: any) => p.id))

  return data
    .map((p: any) => ({
      ...p,
      sales_count: salesMap[p.id] || 0,
      shop_categories: (shopByProduct.get(p.id) || []) as ShopCategoryRow[],
    }))
    .sort((a, b) => b.sales_count - a.sales_count)
}
