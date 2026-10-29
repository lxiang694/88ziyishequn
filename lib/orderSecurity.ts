/**
 * 前台訂單、會員資料的安全檢查（純函式，可測試）。
 *
 * 這些檢查原本散在各 API 裡、而且少了幾個：
 *   • 會員「個人資料」的手機沒有驗證格式，又被直接拼進資料庫查詢條件
 *     （/api/account/orders 的 .or(...)），填一個特製字串就能撈到全站訂單。
 *   • 下單時商品名稱與單價是瀏覽器送來的，改一下就能用 1 元買。
 */

/** 台灣手機：09 開頭共 10 碼。只有通過這個檢查的字串才可以放進查詢條件 */
export const isSafePhone = (p: unknown): p is string => typeof p === 'string' && /^09\d{8}$/.test(p)

type ProfilePatch = Partial<Record<
  'name' | 'phone' | 'line_id' | 'default_store_id' | 'default_store_name' | 'default_store_address' |
  'default_store_county' | 'default_store_district', string | number | null>>

const TEXT_LIMITS: Record<string, number> = {
  name: 40, line_id: 60, default_store_name: 60, default_store_address: 200,
  default_store_county: 20, default_store_district: 20,
}

/** 會員更新個人資料：只收允許的欄位、限制長度、手機必須是正確格式 */
export function sanitizeProfilePatch(body: any): { value?: ProfilePatch; error?: string } {
  const out: ProfilePatch = {}
  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    if (body?.[k] === undefined) continue
    const v = body[k] == null ? '' : String(body[k]).trim()
    if (v.length > max) return { error: '資料太長，請檢查後再試' }
    out[k as keyof ProfilePatch] = v || null
  }
  if (body?.phone !== undefined) {
    const p = body.phone == null ? '' : String(body.phone).replace(/[\s-]/g, '')
    if (p && !isSafePhone(p)) return { error: '手機號碼格式不正確（09xxxxxxxx）' }
    out.phone = p || null
  }
  if (body?.default_store_id !== undefined) {
    const raw = body.default_store_id
    if (raw === null || raw === '') out.default_store_id = null
    else {
      const n = Number(raw)
      if (!Number.isSafeInteger(n) || n <= 0) return { error: '門市資料不正確' }
      out.default_store_id = n
    }
  }
  return { value: out }
}

export interface RequestItem { product_id: unknown; variant_id: unknown; quantity: unknown }
export interface VariantRow {
  id: number; product_id: number; variant_name: string; sale_price: number; sku_code: string | null; is_active: boolean
  products: { product_name: string; cover_image_url: string | null; is_published: boolean } | null
}
export interface PricedItem {
  product_id: number; product_name: string; cover_image_url: string | null
  variant_id: number; variant_name: string; sku_code: string | null; unit_price: number; quantity: number
}

/**
 * 用資料庫裡的規格資料重建訂單明細：名稱、圖片、規格名、單價一律以資料庫為準，
 * 瀏覽器只決定「哪個規格、買幾件」。下架、停售、規格不屬於該商品都擋下。
 */
export function priceOrderItems(items: RequestItem[], variants: VariantRow[]): { value?: PricedItem[]; error?: string } {
  if (!Array.isArray(items) || items.length === 0) return { error: '購物車是空的' }
  if (items.length > 50) return { error: '一次最多 50 項商品' }
  const byId = new Map(variants.map(v => [v.id, v]))
  const seen = new Set<number>()
  const out: PricedItem[] = []
  for (const it of items) {
    const variantId = Number(it?.variant_id), productId = Number(it?.product_id), qty = Number(it?.quantity)
    if (!Number.isSafeInteger(variantId) || !Number.isSafeInteger(productId) || !Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
      return { error: '訂單資料格式錯誤' }
    }
    if (seen.has(variantId)) return { error: '訂單資料格式錯誤' }
    seen.add(variantId)
    const v = byId.get(variantId)
    if (!v || v.product_id !== productId || !v.is_active || !v.products?.is_published) {
      return { error: '有商品已下架或規格已變更，請回購物車重新確認' }
    }
    if (!Number.isFinite(v.sale_price) || v.sale_price < 0) return { error: '有商品暫時無法購買，請洽客服' }
    out.push({
      product_id: productId, product_name: v.products.product_name, cover_image_url: v.products.cover_image_url,
      variant_id: variantId, variant_name: v.variant_name, sku_code: v.sku_code, unit_price: v.sale_price, quantity: qty,
    })
  }
  return { value: out }
}

/** 公開查訂單（用手機或訂單編號）可以回傳的欄位：不含姓名、手機、LINE、備註等個資 */
export const PUBLIC_ORDER_COLUMNS = `
  id, order_no, order_status, total_amount, items_count, created_at,
  store_id, store_name, store_address, county, district,
  order_items(id, variant_id, product_name_snapshot, product_image_snapshot, variant_name_snapshot, unit_price, quantity, subtotal)`
