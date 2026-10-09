/**
 * 判斷一個網址是不是我們自己 Supabase 儲存空間裡的商品圖。
 *
 * 「壓縮既有圖片」會把商品的圖片網址換掉；只允許換成、或換掉自己儲存空間
 * 裡的檔案，避免有人透過這支 API 把商品圖改成任意外部網址。
 */
export const PRODUCT_IMAGE_BUCKET = 'product-images'

export function storagePrefix(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`
}

export function isOwnStorageUrl(url: unknown, supabaseUrl: string): url is string {
  if (typeof url !== 'string' || !supabaseUrl) return false
  const prefix = storagePrefix(supabaseUrl)
  if (!url.startsWith(prefix)) return false
  const path = url.slice(prefix.length)
  // 只接受單純的檔案路徑：不能跳出目錄、不能帶查詢參數
  return /^[A-Za-z0-9._\-/]+$/.test(path) && !path.split('/').some(seg => seg === '' || seg === '.' || seg === '..')
}
