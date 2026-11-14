/**
 * 規格卡上的「每瓶 NT$549・省 NT$62」—— 純函式，不碰資料庫。
 *
 * 從規格名稱讀出「幾個、什麼單位」：1瓶（100顆）、2瓶、三瓶組、6入、1盒（4支）。
 * 只有在兩種以上規格「單位相同、數量不同」時才算（1瓶 vs 2瓶），
 * 算法：最少的那種當基準單價，其他的跟「基準單價 × 數量」比，便宜才寫省多少。
 * 讀不出來、單位不一樣（1瓶 vs 1盒）就不顯示 —— 寧可不寫，也不要寫錯價格。
 */
const CN: Record<string, number> = { 一: 1, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
const UNIT = '瓶|盒|包|袋|罐|入|組|件|支|條|片|顆|粒|個|罐|桶|箱|份|斤'

export function parseCount(name: string): { count: number; unit: string } | null {
  const m = name.match(new RegExp(`(\\d+|[一兩二三四五六七八九十])\\s*(${UNIT})`))
  if (!m) return null
  const count = /\d/.test(m[1]) ? parseInt(m[1], 10) : CN[m[1]]
  return count > 0 ? { count, unit: m[2] } : null
}

export interface Deal { perUnit: number; unit: string; save: number }

export function variantDeals(variants: { id: number; variant_name: string; sale_price: number; is_active?: boolean }[]): Map<number, Deal> {
  const out = new Map<number, Deal>()
  const parsed = variants
    .filter(v => v.is_active !== false && v.sale_price > 0)
    .map(v => ({ v, c: parseCount(v.variant_name) }))
    .filter((x): x is { v: typeof x.v; c: { count: number; unit: string } } => !!x.c)
  if (parsed.length < 2) return out
  const unit = parsed[0].c.unit
  if (parsed.some(x => x.c.unit !== unit)) return out
  if (new Set(parsed.map(x => x.c.count)).size < 2) return out
  const base = parsed.reduce((a, b) => (b.c.count < a.c.count ? b : a))
  const basePer = base.v.sale_price / base.c.count
  for (const { v, c } of parsed) {
    const save = Math.round(basePer * c.count - v.sale_price)
    out.set(v.id, { perUnit: Math.round(v.sale_price / c.count), unit, save: c.count > base.c.count && save > 0 ? save : 0 })
  }
  return out
}
