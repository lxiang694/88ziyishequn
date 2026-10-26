/**
 * 7-11 門市資料（stores_711）的檢查與整理（純函式，可測試）。
 * 後台「門市管理」新增、修改門市時用。
 */
export interface StoreInput {
  store_code: string
  store_name: string
  county: string
  district: string
  address: string
  is_active: boolean
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

/** 檢查後台送來的門市資料；回傳整理好的內容或第一個錯誤 */
export function validateStore(body: any): { ok: true; value: StoreInput } | { ok: false; error: string } {
  const store_code = clean(body?.store_code).replace(/\s/g, '')
  if (!/^\d{6}$/.test(store_code)) return { ok: false, error: '店號要是 6 位數字' }
  // 「7-11 正隆門市」→「正隆」：資料表裡存的是店名本身
  const store_name = clean(body?.store_name).replace(/^(7-?11|7-ELEVEN|統一超商)\s*/i, '').replace(/門市$/, '')
  if (!store_name || store_name.length > 30) return { ok: false, error: '請填門市名稱（30 字以內）' }
  const county = clean(body?.county)
  if (!/^.{1,4}[市縣]$/.test(county)) return { ok: false, error: '縣市格式不正確，例如：新北市' }
  const district = clean(body?.district)
  if (!/^.{1,5}[區鄉鎮市]$/.test(district)) return { ok: false, error: '鄉鎮區格式不正確，例如：板橋區' }
  const address = clean(body?.address)
  if (address.length < 5 || address.length > 120) return { ok: false, error: '請填完整地址' }
  return { ok: true, value: { store_code, store_name, county, district, address, is_active: body?.is_active !== false } }
}

/**
 * 搜尋字串放進 PostgREST 的 or(...) 之前要清乾淨：逗號、括號會被當成查詢語法，
 * 不清掉的話可以拼出別的條件。
 */
export function safeSearchTerm(v: unknown): string {
  return clean(v).replace(/[,()*%\\:"]/g, '').slice(0, 40)
}
