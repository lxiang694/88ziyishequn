/**
 * 快速下單：把解析出來的文字比對到真正的商品與門市。
 *
 * 純函式，不碰資料庫 —— 資料由呼叫端撈好傳進來。
 *
 * ── 設計上的一個原則 ────────────────────────────────────
 * 這個比對**永遠不會自己送出訂單**。它只回傳「最像的幾個」與
 * 一個信心值，由人在畫面上確認後才建立訂單。
 *
 * 理由：比對錯誤的結果是寄錯商品給真實的客戶，成本遠高於
 * 多按一次確認。所以寧可標記「請確認」，也不要安靜地猜。
 */

import { toHalfWidth } from './parse'

/** 比對前的正規化：轉半形、小寫、去掉空白與常見標點 */
export function normalizeForMatch(input: string): string {
  return toHalfWidth(input || '')
    .toLowerCase()
    .replace(/[\s\-_/\\()（）［］\[\]「」『』、,，.。:：;；'"]/g, '')
}

/** 相鄰兩字一組。中文沒有詞界，用 bigram 比整串比對穩定得多 */
export function bigrams(s: string): string[] {
  if (s.length <= 1) return s ? [s] : []
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

/**
 * Dice 係數：兩組 bigram 的重疊比例，0 ~ 1。
 *
 * 用重複計數（不是 Set），否則「油油油」跟「油」會被算成完全相同。
 */
export function similarity(a: string, b: string): number {
  const A = bigrams(normalizeForMatch(a))
  const B = bigrams(normalizeForMatch(b))
  if (A.length === 0 || B.length === 0) {
    const na = normalizeForMatch(a), nb = normalizeForMatch(b)
    return na && na === nb ? 1 : 0
  }
  const pool = new Map<string, number>()
  for (const g of A) pool.set(g, (pool.get(g) || 0) + 1)
  let hit = 0
  for (const g of B) {
    const n = pool.get(g) || 0
    if (n > 0) { hit++; pool.set(g, n - 1) }
  }
  return (2 * hit) / (A.length + B.length)
}

// ── 商品比對 ────────────────────────────────────────────

export interface VariantRow {
  id: number
  variant_name: string
  sale_price: number
  stock_qty: number
  sku_code: string | null
  is_active: boolean
}

export interface ProductRow {
  id: number
  product_name: string
  cover_image_url: string | null
  is_published: boolean
  product_variants: VariantRow[]
}

export interface VariantCandidate {
  product_id: number
  product_name: string
  cover_image_url: string | null
  variant_id: number
  variant_name: string
  sku_code: string | null
  unit_price: number
  stock_qty: number
  score: number
}

/** 低於這個分數就不自動選 —— 看起來選好了但其實選錯，比空著更危險 */
export const MIN_AUTO_SCORE = 0.35
/** 高於這個分數，且明顯領先第二名，才算有把握 */
export const CONFIDENT_SCORE = 0.75
export const CONFIDENT_MARGIN = 0.08

/**
 * 把查詢字串比對到（商品 × 規格）的組合。
 *
 * 分數 = 「商品名 + 規格名」的 bigram 相似度
 *      + 規格名整串出現在查詢裡的加分
 *      + 商品名整串出現在查詢裡的加分
 *
 * 規格加分是關鍵：「20mg 葉黃素軟膠囊」對上 20mg 與 30mg 兩個規格時，
 * 光靠 bigram 只差一點點，加上這一項才會穩定選中 20mg。
 */
export function matchVariants(
  query: string, products: readonly ProductRow[], limit = 5,
): VariantCandidate[] {
  const q = normalizeForMatch(query)
  if (!q) return []

  const out: VariantCandidate[] = []

  for (const p of products) {
    if (!p.is_published) continue
    const pName = normalizeForMatch(p.product_name)

    for (const v of p.product_variants || []) {
      if (!v.is_active) continue
      const vName = normalizeForMatch(v.variant_name)

      let score = similarity(q, `${pName}${vName}`)

      // 規格名直接出現在查詢裡（「20mg」）
      if (vName && vName.length >= 2 && q.includes(vName)) score += 0.15
      // 商品名整串出現在查詢裡
      if (pName && q.includes(pName)) score += 0.2
      // 反過來：查詢整串出現在商品名裡（客戶只寫了一部分）
      else if (pName && pName.includes(q) && q.length >= 2) score += 0.1
      // SKU 完全命中就是它，不用比字
      if (v.sku_code && normalizeForMatch(v.sku_code) === q) score = 2

      out.push({
        product_id: p.id,
        product_name: p.product_name,
        cover_image_url: p.cover_image_url,
        variant_id: v.id,
        variant_name: v.variant_name,
        sku_code: v.sku_code,
        unit_price: v.sale_price,
        stock_qty: v.stock_qty,
        score: Math.min(score, 2),
      })
    }
  }

  return out.sort((a, b) => b.score - a.score || a.product_id - b.product_id)
    .slice(0, limit)
}

/** 最像的那一個夠不夠有把握？不夠的話畫面要標成待確認 */
export function isConfident(candidates: readonly { score: number }[]): boolean {
  if (candidates.length === 0) return false
  if (candidates[0].score < CONFIDENT_SCORE) return false
  if (candidates.length === 1) return true
  return candidates[0].score - candidates[1].score >= CONFIDENT_MARGIN
}

// ── 門市比對 ────────────────────────────────────────────

export interface StoreRow {
  id: number
  store_code: string | null
  store_name: string
  county: string
  district: string
  address: string
}

export interface StoreCandidate extends StoreRow { score: number }

/**
 * 客戶常常會多寫「門市」「店」「7-11」。這些字每一間都有，
 * 留著只會讓所有門市的分數一起變高，反而分不出來。
 */
export function stripStoreNoise(input: string): string {
  return normalizeForMatch(input)
    .replace(/^(7-?11|711|統一超商|超商|小七)/, '')
    .replace(/(門市|門店|店)$/, '')
}

export function matchStores(
  query: string, stores: readonly StoreRow[], limit = 8,
): StoreCandidate[] {
  const q = stripStoreNoise(query)
  if (!q) return []

  const scored = stores.map(s => {
    const name = stripStoreNoise(s.store_name)
    let score: number
    if (name === q) score = 1
    else if (s.store_code && normalizeForMatch(s.store_code) === q) score = 1
    else if (name.startsWith(q)) score = 0.9
    else if (name.includes(q)) score = 0.8
    else score = similarity(q, name)
    return { ...s, score }
  })

  return scored
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score || a.store_name.localeCompare(b.store_name))
    .slice(0, limit)
}

// ── 用門市地址挑門市 ─────────────────────────────────────

/**
 * 地址比對前的整理：臺→台、去掉空白與括號、全形數字轉半形。
 * 「、」「，」換成統一的「、」而不是刪掉 —— 刪掉的話「28、30號」會黏成「2830號」。
 */
export function normalizeAddress(input: string): string {
  return (input || '')
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/臺/g, '台')
    .replace(/[,，]/g, '、')
    .replace(/[\s.。()（）]/g, '')
}

/**
 * 從地址取出「路名＋段」與門牌號碼，例如
 * 「台北市大安區建國南路一段28、30號」→ { road: '建國南路一段', number: '28' }。
 * 用路名搜尋，門牌號碼用來在同一條路上的好幾家門市中挑對的。
 */
export function extractRoad(address: string): { road: string; number: string } {
  const a = normalizeAddress(address).replace(/^.{1,3}[縣市](?:.{1,4}?[區鄉鎮市])?/, '')
  const m = /([^\d]{1,8}?(?:路|街|大道))([一二三四五六七八九十]+段)?/.exec(a)
  if (!m) return { road: '', number: '' }
  const road = m[1].replace(/^.*?[里村鄰]/, '') + (m[2] || '')
  const after = a.slice(m.index + m[0].length)
  const num = /(\d+)(?:[-之]\d+)?號?/.exec(after.replace(/^\d+巷|^\d+弄/g, ''))
  return { road, number: num ? num[1] : '' }
}

/**
 * 訊息裡有附門市地址時，把地址對得上的候選往前排。
 * 例如全台有好幾家「中山」門市，客人的訊息又寫了地址，就能挑對那一家。
 */
export function rankStoresByAddress<T extends StoreRow & { score: number }>(candidates: T[], address: string): T[] {
  const { road, number } = extractRoad(address)
  if (!road) return candidates
  return candidates
    .map(c => {
      const ca = normalizeAddress(c.address)
      let bonus = 0
      if (ca.includes(road)) bonus += 0.1
      if (ca.includes(road) && number && new RegExp(`${road.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\d+巷)?(?:\\d+弄)?${number}(?!\\d)`).test(ca)) bonus += 0.1
      return { ...c, score: c.score + bonus }
    })
    .sort((a, b) => b.score - a.score || a.store_name.localeCompare(b.store_name))
}

/** 訊息只有門市地址、沒有門市名稱時：用地址替門市打分數 */
export function matchStoresByAddress(address: string, stores: readonly StoreRow[], limit = 8): StoreCandidate[] {
  const { road, number } = extractRoad(address)
  if (!road) return []
  return rankStoresByAddress(
    stores.filter(s => normalizeAddress(s.address).includes(road)).map(s => ({ ...s, score: 0.7 })),
    address,
  ).filter(s => s.score >= 0.8 || !number).slice(0, limit)
}
