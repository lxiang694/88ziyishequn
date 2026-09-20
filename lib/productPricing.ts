/**
 * 商品價格與庫存的判斷 —— 純函式，不碰資料庫。
 *
 * 刻意跟 productQuery.ts 分開：那支會 import supabaseAdmin，任何
 * 引用它的地方都會把資料庫 client 拖進來（測試也跑不動）。這兩個
 * 函式只是對已經查到的資料做計算，不該有那個相依。
 *
 * 這裡算出來的數字會直接進到商品頁的 Product 結構化資料，也就是
 * Google 搜尋結果上可能顯示的價格 —— 算錯就是對外報錯價。
 */

/** 可購買規格中的最低售價；沒有可購買規格時回 null */
export function lowestActivePrice(product: any): number | null {
  const prices = (product?.product_variants || [])
    .filter((v: any) => v.is_active)
    .map((v: any) => v.sale_price)
    // 排除 0 與非數字：0 會變成「NT$0」，null 會讓 Math.min 回傳 NaN
    .filter((p: any) => typeof p === 'number' && p > 0)
  return prices.length ? Math.min(...prices) : null
}

/**
 * 有沒有任何規格還買得到。
 *
 * 停用的規格就算庫存數字還在也買不到，不能算有貨 ——
 * 否則搜尋結果顯示 InStock，點進來卻是售完。
 */
export function isInStock(product: any): boolean {
  return (product?.product_variants || []).some(
    (v: any) => v.is_active && v.stock_qty > 0)
}
