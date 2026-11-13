import { supabaseAdmin } from '@/lib/supabase'

/**
 * 資料庫有沒有規格圖片欄位（migrations/variant_images.sql）。
 * 用 limit 0 探測，不讀任何資料；查不到就當還沒執行，其他功能照常。
 */
export async function variantImagesReady(db: { from: (t: string) => any } = supabaseAdmin): Promise<boolean> {
  const { error } = await db.from('product_variants').select('image_url').limit(0)
  return !error
}

export const VARIANT_IMAGES_SQL_HINT = '規格圖片尚未儲存：請先在 Supabase 執行 migrations/variant_images.sql'

const BASE_VARIANT_COLUMNS = 'id, variant_name, sale_price, original_price, stock_qty, sku_code, sort_order, is_active'

/**
 * 前台查規格要用的欄位。
 *
 * 明確列出欄位，不用 *：前台的資料會送到客人的瀏覽器，資料表以後如果多了
 * 不該公開的欄位（例如進貨價），用 * 會一起送出去。
 * image_url 只有在資料庫已經有這一欄時才加 —— 列出不存在的欄位，整個查詢會失敗，
 * 商品頁就打不開了。
 *
 * db 要傳呼叫端自己的 client：前台頁面用的是有快取的 supabaseStorefront，
 * 混用不快取的 client 會讓整頁失去快取。
 */
export async function variantColumns(db: { from: (t: string) => any }): Promise<string> {
  return (await variantImagesReady(db)) ? `${BASE_VARIANT_COLUMNS}, image_url` : BASE_VARIANT_COLUMNS
}
