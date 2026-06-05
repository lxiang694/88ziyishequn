/**
 * Smart sleep-product recommender.
 *
 * Given a pool of sleep-relax products + the user's ISI severity level,
 * compute a match score for each product based on:
 *   • In-stock + active variants (mandatory)
 *   • Ingredient keyword match against severity level
 *   • Sales volume (cap to avoid old bestsellers smothering everything)
 *   • Recency boost for newly-listed items (last 30 days)
 *
 * Returns the top-N products with a one-line "match reason" tag for UI display.
 */

export type SleepSeverity = 'green' | 'yellow' | 'orange' | 'red'

export interface ScoredProduct {
  product: any
  score: number
  reason: string
  isNew: boolean
}

// Ingredient keywords mapped to each severity level.
// As you add more products, just include relevant keywords in the product name
// or description and they'll automatically be picked up.
const KEYWORDS_BY_SEVERITY: Record<SleepSeverity, string[]> = {
  green: ['茶氨酸', 'theanine', '鎂', 'magnesium', 'b群', 'b complex', '甘氨酸'],
  yellow: ['鎂', 'gaba', '茶氨酸', 'theanine', 'b群', '色胺酸', 'tryptophan', '甘氨酸', '洋甘菊'],
  orange: ['gaba', '酸棗仁', '褪黑', 'melatonin', '鎂', '色胺酸', 'tryptophan', '蘇糖酸鎂'],
  red: ['褪黑', 'melatonin', '酸棗仁', 'gaba', '色胺酸', '蘇糖酸鎂'],
}

// Friendly Chinese names for matched ingredients (for the "reason" tag)
const FRIENDLY_NAME: Record<string, string> = {
  '鎂': '鎂', 'magnesium': '鎂',
  '蘇糖酸鎂': '蘇糖酸鎂',
  '甘氨酸': '甘氨酸鎂',
  'gaba': 'GABA',
  '褪黑': '褪黑激素', 'melatonin': '褪黑激素',
  '酸棗仁': '酸棗仁',
  '茶氨酸': 'L-茶氨酸', 'theanine': 'L-茶氨酸',
  'b群': 'B 群', 'b complex': 'B 群',
  '色胺酸': '色胺酸', 'tryptophan': '色胺酸',
  '洋甘菊': '洋甘菊',
}

const NEW_PRODUCT_DAYS = 30
const RECENCY_BOOST_MAX = 25
const SALES_BOOST_CAP = 35
const KEYWORD_BOOST = 14

function hasActiveStock(product: any): boolean {
  const variants = product.product_variants || []
  return variants.some((v: any) => v.is_active && v.stock_qty > 0)
}

function getProductText(product: any): string {
  return [
    product.product_name,
    product.short_intro,
    product.ingredients,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getDaysSinceCreated(createdAt: string | undefined | null): number {
  if (!createdAt) return 365
  const ms = Date.now() - new Date(createdAt).getTime()
  return Math.max(0, ms / 86400000)
}

function buildReason(matched: string[], isNew: boolean, severity: SleepSeverity): string {
  const friendly = Array.from(
    new Set(matched.map(k => FRIENDLY_NAME[k.toLowerCase()] || k))
  ).slice(0, 2)

  const tags: string[] = []
  if (isNew) tags.push('新品上架')
  if (friendly.length > 0) tags.push(`含 ${friendly.join('、')}`)

  if (tags.length === 0) {
    // No keyword match — explain by severity context
    const fallback: Record<SleepSeverity, string> = {
      green: '日常維護首選',
      yellow: '熱門助眠選擇',
      orange: '中度失眠常用',
      red: '深度需求建議',
    }
    tags.push(fallback[severity])
  }

  return tags.join(' · ')
}

export function scoreSleepProduct(
  product: any,
  severity: SleepSeverity,
  salesCount: number
): ScoredProduct | null {
  if (!hasActiveStock(product)) return null

  const text = getProductText(product)
  const keywords = KEYWORDS_BY_SEVERITY[severity]

  // 1. Keyword match
  const matched: string[] = []
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) matched.push(kw)
  }
  const keywordScore = matched.length * KEYWORD_BOOST

  // 2. Sales boost (capped — newer products shouldn't be drowned out)
  const salesScore = Math.min(SALES_BOOST_CAP, salesCount * 1.5)

  // 3. Recency boost (linear decay over 30 days)
  const ageDays = getDaysSinceCreated(product.created_at)
  const recencyScore = ageDays < NEW_PRODUCT_DAYS
    ? RECENCY_BOOST_MAX * (1 - ageDays / NEW_PRODUCT_DAYS)
    : 0
  const isNew = ageDays < NEW_PRODUCT_DAYS

  // 4. Base score
  const baseScore = 30

  const score = baseScore + keywordScore + salesScore + recencyScore

  return {
    product,
    score: Math.round(score),
    reason: buildReason(matched, isNew, severity),
    isNew,
  }
}

export function rankSleepProducts(
  products: any[],
  salesMap: Record<number, number>,
  severity: SleepSeverity,
  topN = 3
): ScoredProduct[] {
  const scored = products
    .map(p => scoreSleepProduct(p, severity, salesMap[p.id] || 0))
    .filter((s): s is ScoredProduct => s !== null)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topN)
}
