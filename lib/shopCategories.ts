/**
 * 商品分類（逛街用的分類）。
 *
 * 為什麼要新增一套，而不是改掉原本的 health_categories
 * ────────────────────────────────────────────────────
 * health_categories 是「健康訴求」分類（骨關節、心血管、助眠…），
 * 它同時被這些地方用著：
 *   • health_articles.category_slug —— 每篇健康知識屬於哪個訴求
 *   • lib/articleProductMatcher.ts —— 文章底下推薦哪些商品
 *   • lib/productArticleMatcher.ts —— 商品頁的延伸閱讀
 *   • 健康自測 / 睡眠自測的結果頁
 *
 * 這一套則是「商品型態」分類（營養支持、養身茶飲、膏方…），是客人逛
 * 賣場時的動線。兩者是不同的軸，都有用：客人想買茶飲時不會想「我要
 * 心血管保健」，但一篇講心血管的文章要推薦商品時，「營養支持」又太粗。
 *
 * 所以前台購物動線改用這一套，健康訴求那套留給文章與自測繼續用。
 *
 * 分類清單放在程式裡當單一事實來源，資料庫的 shop_categories 由
 * migration 依這份清單種入。這樣即使資料表還沒建好或讀取失敗，前台
 * 仍然有分類可以顯示，不會變成一片空白。
 */

export interface ShopCategorySeed {
  slug: string
  name: string
  emoji: string
  /** 分類頁的一句話說明，也當作 meta description */
  description: string
  /**
   * 劑型／品項形式，是決定分類的關鍵字。
   *
   * 「桂圓紅棗茶包」該歸養身茶飲，不是傳統滋補 —— 桂圓和紅棗只是
   * 材料，「茶包」才決定它是什麼商品。所以形式詞的權重遠高於材料詞，
   * 不然兩個材料詞就能把一個形式詞蓋過去（這是實測踩到的）。
   */
  forms: string[]
  /**
   * 材料／成分關鍵字，用來加分與打平手。
   *
   * 刻意避開單字通用詞。例如不收「油」—— 紫蘇油屬營養支持、精油屬
   * 外用草本，單看一個「油」字只會兩邊都猜錯；也不收「鐵」，否則
   * 鐵鍋會被當成補鐵的營養素。
   */
  keywords: string[]
}

export const SHOP_CATEGORIES: ShopCategorySeed[] = [
  {
    slug: 'nutrition',
    name: '營養支持',
    emoji: '💊',
    description: '每日補充的營養素與機能性食用油，膠囊、軟膠囊、錠劑與粉包。',
    forms: ['軟膠囊', '膠囊', '錠劑', '口含錠', '粉包', '滴劑', '冷壓', '初榨', '食用油', '保健食品', '營養素'],
    keywords: [
      '維生素', '維他命', '葉黃素', '魚油', '益生菌', '益生元', '膠原蛋白',
      '葡萄糖胺', '軟骨素', '輔酶', 'q10', 'coq10', 'b群', '綜合維', '螯合鋅',
      '鋅酵母', 'omega', 'dha', 'epa', '鈣片', '鐵劑', '葉酸', '薑黃素',
      '紫蘇油', '紫蘇籽油', '茶籽油', '苦茶油', '沙棘', '亞麻仁', '月見草',
      '大豆異黃酮', '蔓越莓', '納豆激酶', '紅麴', '蝦紅素',
    ],
  },
  {
    slug: 'tea',
    name: '養身茶飲',
    emoji: '🍵',
    description: '天天喝得下去的茶包與沖泡飲品，溫和、順口、好持續。',
    forms: ['茶包', '茶飲', '養生茶', '代用茶', '沖泡', '沖飲', '茶磚', '花茶', '青草茶'],
    keywords: [
      '決明子', '菊花', '枸杞茶', '黑豆水', '桂圓茶', '薑茶', '黑糖薑',
      '普洱', '烏龍', '紅茶', '綠茶', '麥茶',
    ],
  },
  {
    slug: 'snacks',
    name: '健康零食',
    emoji: '🥜',
    description: '嘴饞時的替代選擇：堅果、果乾與少負擔的點心。',
    forms: ['零食', '果乾', '隨手包', '穀物棒', '能量棒', '米餅', '脆片', '蜜餞'],
    keywords: [
      '堅果', '核桃', '杏仁', '腰果', '南瓜子', '葵瓜子', '燕麥', '海苔',
      '蒟蒻', '黑棗', '蜜棗', '無花果',
    ],
  },
  {
    slug: 'patch-care',
    name: '個護敷貼',
    emoji: '🩹',
    description: '貼上就走的日常照護，與隨身清潔保養用品。',
    forms: ['敷貼', '膏貼', '穴位貼', '足貼', '肚臍貼', '艾灸貼', '暖貼', '暖暖包',
            '眼膜', '面膜', '牙膏', '牙粉', '漱口水', '洗髮', '沐浴', '濕紙巾'],
    keywords: ['護墊', '眼罩', '艾絨'],
  },
  {
    slug: 'foot-bath',
    name: '足浴香囊',
    emoji: '👣',
    description: '睡前泡腳包與隨身香囊，用氣味與溫度把一天收起來。',
    forms: ['足浴包', '足浴', '泡腳', '沐足', '藥浴', '浴包', '香囊', '香包', '驅蚊包'],
    keywords: ['艾草', '艾葉', '藏紅花', '生薑粉'],
  },
  {
    slug: 'herbal-paste',
    name: '養生膏方',
    emoji: '🍯',
    description: '一匙一匙吃的膏方，傳統做法、慢慢調養。',
    forms: ['膏方', '膏滋', '熬膏', '秋梨膏', '枇杷膏', '阿膠糕', '阿膠膏',
            '蜂蜜膏', '桑椹膏', '黑芝麻膏', '玫瑰膏', '龜苓膏'],
    keywords: ['古法', '九蒸九曬'],
  },
  {
    slug: 'tonic',
    name: '傳統滋補',
    emoji: '🍲',
    description: '藥膳、燉品與經典滋補食材，家裡廚房就能用。',
    forms: ['滋補', '藥膳', '燉包', '燉湯', '湯包', '雞精', '滴雞精', '食療'],
    keywords: [
      '燕窩', '人參', '西洋參', '靈芝', '蟲草', '阿膠', '四物', '八珍',
      '當歸', '黃耆', '紅棗', '桂圓', '黑芝麻', '山藥', '茯苓', '銀耳',
    ],
  },
  {
    slug: 'topical-herbal',
    name: '外用草本保養',
    emoji: '🌿',
    description: '抹在身上的草本配方：按摩油、舒緩霜與噴霧。',
    forms: ['按摩油', '推拿油', '活絡油', '藥油', '精油', '舒緩霜', '護手霜',
            '身體乳', '乳霜', '凝膠', '噴霧', '草本膏', '薄荷膏', '外用'],
    keywords: ['萬金油', '白花油', '樟腦', '尤加利', '迷迭香'],
  },
  {
    slug: 'home-living',
    name: '居家生活',
    emoji: '🏠',
    description: '會陪你很久的日常器物：鍋具、燈具與廚房小件。',
    forms: ['鐵鍋', '鍋具', '炒鍋', '湯鍋', '砂鍋', '陶鍋', '保溫杯', '燜燒罐',
            '養生壺', '照護燈', '燈具', '刀具', '砧板', '餐具', '茶具'],
    keywords: ['紅光', '近紅外線', '無塗層', '手工鍛打', '毛巾', '蕎麥枕'],
  },
]

export const SHOP_CATEGORY_SLUGS = SHOP_CATEGORIES.map(c => c.slug)

export function isShopCategorySlug(value: unknown): value is string {
  return typeof value === 'string' && SHOP_CATEGORY_SLUGS.includes(value)
}

export function shopCategoryBySlug(slug: string): ShopCategorySeed | undefined {
  return SHOP_CATEGORIES.find(c => c.slug === slug)
}

// ── 自動建議 ───────────────────────────────────────────

export interface CategorySuggestion {
  slug: string
  /** 命中的關鍵字，讓使用者看得出為什麼被建議 */
  matched: string[]
  score: number
}

/**
 * 形式詞的權重倍率。
 *
 * 設 5 是因為要讓一個形式詞穩穩壓過兩到三個材料詞：「桂圓紅棗茶包」
 * 裡桂圓與紅棗加起來 4 分，「茶包」必須明顯更高，才不會被歸到傳統滋補。
 */
const FORM_WEIGHT = 5

/** 命中越長的關鍵字越有把握：「紫蘇籽油」比「魚油」可信得多 */
function weight(keyword: string, isForm: boolean): number {
  return keyword.length * (isForm ? FORM_WEIGHT : 1)
}

/**
 * 依商品名稱與簡介猜可能的分類。
 *
 * 這只是「建議」，不是自動套用。站上既有商品都還沒有商品分類，一個一個
 * 補很花時間，但猜錯的成本也不是零 —— 分錯類客人就找不到 —— 所以後台
 * 把建議標示出來、由人按一下確認，不會自己寫進資料庫。
 */
export function suggestShopCategories(
  product: { product_name?: string | null; short_intro?: string | null; ingredients?: string | null },
  topN = 2,
): CategorySuggestion[] {
  const text = [product.product_name, product.short_intro, product.ingredients]
    .filter(Boolean).join(' ').toLowerCase()
  if (!text.trim()) return []

  const scored: CategorySuggestion[] = []
  for (const cat of SHOP_CATEGORIES) {
    const forms = cat.forms.filter(k => text.includes(k.toLowerCase()))
    const ingredients = cat.keywords.filter(k => text.includes(k.toLowerCase()))
    if (forms.length === 0 && ingredients.length === 0) continue
    scored.push({
      slug: cat.slug,
      // 形式詞放前面，後台顯示理由時先看到最有決定性的那個
      matched: [...forms, ...ingredients],
      score: forms.reduce((sum, k) => sum + weight(k, true), 0)
        + ingredients.reduce((sum, k) => sum + weight(k, false), 0),
    })
  }

  return scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug)).slice(0, topN)
}

/**
 * 從表單送來的分類 id 清單整理出乾淨的陣列。
 *
 * 會丟掉非數字、重複與負數。回傳空陣列代表「沒有選任何分類」，
 * 呼叫端要自己決定那是不是錯誤 —— 商品上架時是，篩選時不是。
 */
export function normalizeCategoryIds(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  const out: number[] = []
  const seen = new Set<number>()
  for (const raw of input) {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}
