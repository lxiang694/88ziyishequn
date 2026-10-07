/**
 * 後台訂單搜尋字串的整理 —— 純函式，可單元測試。
 *
 * 搜尋條件會被組進 PostgREST 的 or() 語法：
 *   or=(order_no.ilike.%X%,customer_name.ilike.%X%,phone.ilike.%X%)
 *
 * 使用者輸入的內容直接塞進去，逗號與括號會破壞這個結構，
 * 百分比與底線則是 LIKE 的萬用字元 —— 輸入一個 % 就會撈出全部訂單。
 */

/** 會破壞 or() 結構的字元（雙引號在 PostgREST 裡是值的引號） */
const STRUCTURAL = /[,()"]/g
/** LIKE 萬用字元與跳脫字元 */
const WILDCARD = /[%_\\*]/g

export function sanitizeOrderSearch(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .replace(STRUCTURAL, ' ')
    .replace(WILDCARD, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

/**
 * 搜尋時要不要套用期間篩選。
 *
 * 答案是「不要」。搜尋訂單號、姓名或手機是「找特定的某一筆」，
 * 不是在瀏覽某個期間 —— 使用者不會知道那筆訂單是哪個月下的，
 * 知道的話也不需要搜尋。
 *
 * 實際踩到的情況：儀表板的「本月訂單」連到 /admin/orders?dateRange=month，
 * 從那裡進來之後期間篩選一直留著，搜舊訂單就永遠找不到，
 * 而畫面上完全沒有提示。
 */
export function shouldApplyDateFilter(search: string, dateRange: string): boolean {
  if (search) return false
  return !!dateRange
}

/** 商品關鍵字最多幾個詞 —— 每多一個詞就多一組 ilike 條件 */
export const MAX_PRODUCT_TERMS = 3

/**
 * 商品關鍵字拆成詞。
 *
 * 商品名稱與規格是 order_items 的兩個欄位，輸入「紫蘇油 3瓶」若整串去比
 * 一定比不到。所以用空白拆開，每個詞各自比對名稱、規格或貨號。
 */
export function productKeywordTerms(raw: string | null | undefined): string[] {
  const cleaned = sanitizeOrderSearch(raw)
  if (!cleaned) return []
  return Array.from(new Set(cleaned.split(' '))).slice(0, MAX_PRODUCT_TERMS)
}

/**
 * 每個詞一組 or() 條件，套在 order_items 上。
 *
 * 多組條件之間是 AND，而且是對「同一筆商品明細」成立 —— 「紫蘇油 3瓶」
 * 找的是有一項商品叫紫蘇油、規格是 3 瓶的訂單，不是買了紫蘇油、另一項
 * 商品剛好是 3 瓶的訂單。
 */
export function productKeywordFilters(terms: string[]): string[] {
  return terms.map(t =>
    `product_name_snapshot.ilike.%${t}%,variant_name_snapshot.ilike.%${t}%,sku_snapshot.ilike.%${t}%`)
}

/** 期間篩選是否因為搜尋而被略過 —— 用來在畫面上提示使用者 */
export function isDateFilterOverridden(search: string, dateRange: string): boolean {
  return !!search && !!dateRange
}
