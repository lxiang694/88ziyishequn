/**
 * Smart product recommender for health articles.
 *
 * Given a pool of products from the article's category + the category slug,
 * compute a match score for each product based on:
 *   • In-stock + active variants (mandatory)
 *   • Ingredient/keyword match against the article's category
 *   • Sales volume (capped — newer products shouldn't be drowned out)
 *   • Recency boost for newly-listed items (last 30 days)
 *
 * Returns the top-N products with a one-line "match reason" tag for UI.
 */

export interface ScoredArticleProduct {
  product: any
  score: number
  reason: string
  isNew: boolean
}

// Category → key ingredients/keywords. Match against product name/intro/ingredients.
// To extend: add new keywords here. Products with matching text in any field are auto-detected.
const KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  'bone-joint': ['葡萄糖胺', 'glucosamine', '軟骨素', 'chondroitin', '薑黃', 'curcumin', '鈣', 'calcium', '維生素d', '膠原蛋白', 'collagen', 'msm', '甲基硫醯基甲烷'],
  'cardiovascular': ['魚油', 'omega-3', 'omega', 'epa', 'dha', '輔酶q10', 'coq10', 'q10', '紅麴', '納豆激酶', 'nattokinase', '大蒜精', 'garlic'],
  'digestive': ['益生菌', 'probiotic', '益生元', 'prebiotic', '消化酵素', 'enzyme', '膳食纖維', 'fiber', '薑黃', '菊苣', 'inulin'],
  'sleep-relax': ['gaba', '酸棗仁', '褪黑', 'melatonin', '鎂', 'magnesium', '色胺酸', 'tryptophan', '茶氨酸', 'theanine', '甘氨酸', 'b群', '洋甘菊'],
  'eye-care': ['葉黃素', 'lutein', '玉米黃素', 'zeaxanthin', '花青素', 'anthocyanin', '蝦紅素', 'astaxanthin', 'dha', '維生素a', '玻尿酸', 'hyaluronic', '山桑子', 'bilberry'],
  'immune': ['維生素c', 'vitamin c', '維生素d', 'vitamin d', '鋅', 'zinc', '益生菌', '蜂膠', 'propolis', '靈芝', 'reishi', 'β-葡聚醣', 'beta-glucan', '接骨木莓', 'elderberry', '紫錐菊', 'echinacea'],
  'beauty-skin': ['膠原蛋白', 'collagen', '玻尿酸', 'hyaluronic', '維生素c', '維生素e', '白藜蘆醇', 'resveratrol', '菸鹼醯胺', 'niacinamide', '生物素', 'biotin', '穀胱甘肽', 'glutathione'],
  'weight-management': ['乳清蛋白', 'whey', '左旋肉鹼', 'l-carnitine', '共軛亞麻油酸', 'cla', '綠茶', '兒茶素', 'egcg', '白腎豆', '鉻', 'chromium', '藤黃果'],
  'womens-health': ['大豆異黃酮', 'isoflavone', '月見草油', 'evening primrose', '琉璃苣油', '鈣', '維生素d', '維生素k2', '蔓越莓', 'cranberry', '玻尿酸', '葉酸', 'folate', '鐵'],
  'mens-health': ['鋸棕櫚', 'saw palmetto', '番茄紅素', 'lycopene', '鋅', 'zinc', '瑪卡', 'maca', '東革阿里', 'tongkat ali', '南瓜籽', 'pumpkin seed', 'l-精胺酸', 'arginine', '輔酶q10'],
  'children-growth': ['鈣', '維生素d', 'dha', 'b群', '鐵', '益生菌', '葉黃素', '魚油'],
  'senior-health': ['銀杏葉', 'ginkgo', '磷脂醯絲胺酸', 'phosphatidylserine', 'ps', 'q10', 'dha', '薑黃素', 'curcumin', '白藜蘆醇', 'resveratrol', 'nad', 'akg', 'b12', '葉酸'],
}

// Friendly Chinese display names for the recommendation reason tag
const FRIENDLY_NAME: Record<string, string> = {
  '葡萄糖胺': '葡萄糖胺', 'glucosamine': '葡萄糖胺',
  '軟骨素': '軟骨素', 'chondroitin': '軟骨素',
  '薑黃': '薑黃', 'curcumin': '薑黃素',
  '鈣': '鈣', 'calcium': '鈣',
  '維生素d': '維生素 D',
  '膠原蛋白': '膠原蛋白', 'collagen': '膠原蛋白',
  'msm': 'MSM',
  '魚油': 'Omega-3', 'omega-3': 'Omega-3', 'omega': 'Omega-3',
  '輔酶q10': '輔酶 Q10', 'coq10': '輔酶 Q10', 'q10': '輔酶 Q10',
  '紅麴': '紅麴',
  '納豆激酶': '納豆激酶', 'nattokinase': '納豆激酶',
  '大蒜精': '大蒜精',
  '益生菌': '益生菌', 'probiotic': '益生菌',
  '益生元': '益生元',
  '消化酵素': '消化酵素', 'enzyme': '酵素',
  '膳食纖維': '膳食纖維',
  '菊苣': '菊苣纖維',
  'gaba': 'GABA',
  '酸棗仁': '酸棗仁',
  '褪黑': '褪黑激素', 'melatonin': '褪黑激素',
  '鎂': '鎂', 'magnesium': '鎂',
  '色胺酸': '色胺酸', 'tryptophan': '色胺酸',
  '茶氨酸': 'L-茶氨酸', 'theanine': 'L-茶氨酸',
  '甘氨酸': '甘氨酸',
  'b群': 'B 群',
  '洋甘菊': '洋甘菊',
  '葉黃素': '葉黃素', 'lutein': '葉黃素',
  '玉米黃素': '玉米黃素', 'zeaxanthin': '玉米黃素',
  '花青素': '花青素',
  '蝦紅素': '蝦紅素', 'astaxanthin': '蝦紅素',
  'dha': 'DHA',
  '維生素a': '維生素 A',
  '玻尿酸': '玻尿酸',
  '山桑子': '山桑子',
  '維生素c': '維生素 C', 'vitamin c': '維生素 C',
  'vitamin d': '維生素 D',
  '鋅': '鋅', 'zinc': '鋅',
  '蜂膠': '蜂膠', 'propolis': '蜂膠',
  '靈芝': '靈芝',
  'β-葡聚醣': 'β-葡聚醣',
  '接骨木莓': '接骨木莓',
  '紫錐菊': '紫錐菊',
  '維生素e': '維生素 E',
  '白藜蘆醇': '白藜蘆醇', 'resveratrol': '白藜蘆醇',
  '菸鹼醯胺': '菸鹼醯胺',
  '生物素': '生物素', 'biotin': '生物素',
  '穀胱甘肽': '穀胱甘肽',
  '乳清蛋白': '乳清蛋白', 'whey': '乳清蛋白',
  '左旋肉鹼': 'L-肉鹼', 'l-carnitine': 'L-肉鹼',
  '共軛亞麻油酸': 'CLA', 'cla': 'CLA',
  '綠茶': '綠茶兒茶素', '兒茶素': '兒茶素',
  '白腎豆': '白腎豆',
  '鉻': '鉻', 'chromium': '鉻',
  '藤黃果': '藤黃果',
  '大豆異黃酮': '大豆異黃酮', 'isoflavone': '大豆異黃酮',
  '月見草油': '月見草油',
  '琉璃苣油': '琉璃苣油',
  '維生素k2': '維生素 K2',
  '蔓越莓': '蔓越莓', 'cranberry': '蔓越莓',
  '葉酸': '葉酸',
  '鐵': '鐵',
  '鋸棕櫚': '鋸棕櫚', 'saw palmetto': '鋸棕櫚',
  '番茄紅素': '番茄紅素', 'lycopene': '番茄紅素',
  '瑪卡': '瑪卡',
  '東革阿里': '東革阿里',
  '南瓜籽': '南瓜籽',
  'l-精胺酸': 'L-精胺酸',
  '銀杏葉': '銀杏葉',
  '磷脂醯絲胺酸': '磷脂醯絲胺酸',
  'ps': 'PS 磷脂醯絲胺酸',
  'nad': 'NAD',
  'akg': 'AKG',
  'b12': '維生素 B12',
}

// Friendly fallback when no keyword matches
const CATEGORY_FALLBACK: Record<string, string> = {
  'bone-joint': '骨關節保養必選',
  'cardiovascular': '心血管保健推薦',
  'digestive': '腸胃保健常用',
  'sleep-relax': '助眠保養首選',
  'eye-care': '護眼保健精選',
  'immune': '免疫力保養必備',
  'beauty-skin': '美容保養人氣',
  'weight-management': '體重管理熱門',
  'womens-health': '女性保健優選',
  'mens-health': '男性保健常用',
  'children-growth': '兒童成長必選',
  'senior-health': '銀髮保健精選',
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
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86400000)
}

function buildReason(matched: string[], isNew: boolean, categorySlug: string): string {
  const friendly = Array.from(
    new Set(matched.map(k => FRIENDLY_NAME[k.toLowerCase()] || k))
  ).slice(0, 2)

  const tags: string[] = []
  if (isNew) tags.push('新品上架')
  if (friendly.length > 0) {
    tags.push(`含 ${friendly.join('、')}`)
  } else {
    tags.push(CATEGORY_FALLBACK[categorySlug] || '熱門推薦')
  }

  return tags.join(' · ')
}

export function rankArticleProducts(
  products: any[],
  salesMap: Record<number, number>,
  categorySlug: string,
  topN = 3
): ScoredArticleProduct[] {
  const keywords = KEYWORDS_BY_CATEGORY[categorySlug] || []

  const scored = products
    .map(product => {
      if (!hasActiveStock(product)) return null

      const text = getProductText(product)
      const matched: string[] = []
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) matched.push(kw)
      }

      const keywordScore = matched.length * KEYWORD_BOOST
      const salesScore = Math.min(SALES_BOOST_CAP, (salesMap[product.id] || 0) * 1.5)
      const ageDays = getDaysSinceCreated(product.created_at)
      const recencyScore = ageDays < NEW_PRODUCT_DAYS
        ? RECENCY_BOOST_MAX * (1 - ageDays / NEW_PRODUCT_DAYS)
        : 0
      const isNew = ageDays < NEW_PRODUCT_DAYS

      const score = 30 + keywordScore + salesScore + recencyScore

      return {
        product,
        score: Math.round(score),
        reason: buildReason(matched, isNew, categorySlug),
        isNew,
      }
    })
    .filter((s): s is ScoredArticleProduct => s !== null)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topN)
}
