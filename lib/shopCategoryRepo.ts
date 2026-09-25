import { supabaseAdmin } from '@/lib/supabase'

/**
 * 商品分類關聯的讀寫。伺服器端專用（用的是 service_role）。
 *
 * 這裡每個函式都把「資料表還不存在」當成正常情況容錯處理。
 * 遷移是使用者自己在 Supabase SQL Editor 執行的，程式碼會比資料表
 * 先上線一段時間 —— 那段期間商品管理與賣場都必須照常運作，只是
 * 少了分類而已。整頁壞掉的代價遠大於少一塊標籤。
 */

export interface ShopCategoryRow {
  id: number
  name: string
  slug: string
  emoji: string
}

/** 商品 id → 它掛著的商品分類 */
export async function shopCategoriesByProduct(
  productIds: number[],
): Promise<Map<number, ShopCategoryRow[]>> {
  const out = new Map<number, ShopCategoryRow[]>()
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

/**
 * 把一件商品的分類整組換掉。
 *
 * 先刪後插而不是算差集 —— 分類最多九個，差集的程式碼比較長也比較
 * 容易寫錯，而這張表沒有其他欄位會因為重建而遺失。
 *
 * 回傳是否真的寫成功，呼叫端可以據此決定要不要提醒使用者。
 */
export async function saveShopCategories(productId: number, categoryIds: number[]): Promise<boolean> {
  const { error: delError } = await supabaseAdmin
    .from('product_shop_category_relations')
    .delete()
    .eq('product_id', productId)
  if (delError) return false

  if (categoryIds.length === 0) return true

  const { error } = await supabaseAdmin
    .from('product_shop_category_relations')
    .insert(categoryIds.map(id => ({ product_id: productId, shop_category_id: id })))
  return !error
}

/** 後台用的完整分類清單（含停用的） */
export async function allShopCategories(): Promise<ShopCategoryRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('shop_categories')
    .select('id, name, slug, emoji, description, sort_order, is_active')
    .order('sort_order')
  if (error) return null
  return (data || []) as any
}
