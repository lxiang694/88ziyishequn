/**
 * 商品頁的「相關健康知識」推薦 —— 純函式，不碰資料庫。
 *
 * 站上已經有「文章 → 商品」的推薦（lib/articleProductMatcher.ts），
 * 但沒有反方向。結果是像紫蘇油這種主題，明明有兩篇文章加一個商品，
 * 三個頁面卻互不連結 —— 使用者看完商品不知道有文章可讀，
 * 搜尋引擎也看不出它們是同一個主題。
 *
 * ── 比對為什麼不能只用子字串 ────────────────────────────
 * 商品叫「紫蘇籽油」，文章標題是「紫蘇油適合誰？…」。
 * 「紫蘇籽油」不是「紫蘇油適合誰」的子字串（中間多一個「籽」），
 * 直接 includes 會完全抓不到。
 *
 * 所以改成從商品名稱切出 2～4 字的片段去比對：「紫蘇」「紫蘇籽」
 * 「蘇籽油」…其中「紫蘇」命中文章標題。片段越長給分越高，
 * 因為越長代表越specific。
 */

export interface ArticleLike {
  id: number
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  category_slug: string | null
  reading_minutes: number | null
  view_count: number | null
}

export interface ScoredArticle {
  article: ArticleLike
  score: number
  /** 給畫面顯示的推薦理由 */
  reason: string
}

/** 同分類的加分。分類是人工掛的，比字面比對可信。 */
const CATEGORY_BOOST = 25
/** 瀏覽數的加分上限 —— 熱門文章優先，但不能讓新文章完全沒機會 */
const VIEW_BOOST_CAP = 12
const MIN_SCORE = 12

/**
 * 這些片段幾乎每個保健品名稱都有，命中了也說明不了相關性。
 * 不排除的話，「綜合維生素」會跟每一篇文章都沾上邊。
 */
const GENERIC = new Set([
  '保健', '食品', '營養', '配方', '膠囊', '軟膠', '錠劑', '粉包',
  '有機', '天然', '精純', '高濃', '濃度', '複方', '綜合', '專利',
  '公司', '代購', '推薦', '嚴選',
])

export function normalizeText(input: string | null | undefined): string {
  return (input || '')
    .toLowerCase()
    // 【小莊代購】這類前綴不是商品特徵
    .replace(/【[^】]*】/g, '')
    .replace(/[\s　·・、，,。.：:；;（）()\[\]「」『』／/+*%-]/g, '')
}

/**
 * 從商品名稱切出用來比對的片段（2～4 字）。
 *
 * 只取中日韓文字與英數連續段，跳過通用詞。
 */
export function nameFragments(productName: string): string[] {
  const text = normalizeText(productName)
  const out = new Set<string>()
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i + len <= text.length; i++) {
      const frag = text.slice(i, i + len)
      if (GENERIC.has(frag)) continue
      out.add(frag)
    }
  }
  return [...out]
}

/**
 * 把文章依「與這個商品的相關程度」排序。
 *
 * 分數來源：
 *   1. 名稱片段命中文章標題或摘要 —— 片段越長分數越高
 *      （標題命中比摘要命中重要，標題是文章的主題宣告）
 *   2. 文章分類在商品的分類裡 —— 人工掛的關聯，可信度高
 *   3. 瀏覽數（有上限）
 *
 * 低於門檻的不回傳。寧可不顯示，也不要在紫蘇油商品頁推薦一篇
 * 講膝蓋的文章 —— 那比沒有推薦更傷信任。
 */
export function rankProductArticles(
  articles: readonly ArticleLike[] | null | undefined,
  product: { product_name?: string; product_category_relations?: any[] } | null | undefined,
  topN = 3,
): ScoredArticle[] {
  if (!articles?.length || !product?.product_name) return []

  const fragments = nameFragments(product.product_name)
  const productCats = new Set(
    (product.product_category_relations || [])
      .map((r: any) => r?.health_categories?.slug)
      .filter(Boolean),
  )

  const scored = articles.map(article => {
    const title = normalizeText(article.title)
    const excerpt = normalizeText(article.excerpt)

    let best = 0
    let bestFrag = ''
    for (const frag of fragments) {
      // 標題命中給滿分，摘要命中給七折
      const hit = title.includes(frag) ? frag.length * 10
        : excerpt.includes(frag) ? frag.length * 7
        : 0
      if (hit > best) { best = hit; bestFrag = frag }
    }

    const categoryHit = !!article.category_slug && productCats.has(article.category_slug)
    const viewScore = Math.min(VIEW_BOOST_CAP, Math.floor((article.view_count || 0) / 20))

    const score = best + (categoryHit ? CATEGORY_BOOST : 0) + viewScore

    return {
      article,
      score,
      reason: best > 0 && bestFrag
        ? `提到${bestFrag}`
        : categoryHit ? '同類主題' : '延伸閱讀',
    }
  })

  return scored
    .filter(s => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || (b.article.view_count || 0) - (a.article.view_count || 0))
    .slice(0, topN)
}
