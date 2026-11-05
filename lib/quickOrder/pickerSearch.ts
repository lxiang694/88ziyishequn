/**
 * 代客下單「手動選商品」的搜尋（純函式，可測試）。
 *
 * 客人在 LINE 上打的商品名常常跟網站上的不完全一樣（「葉黃素軟膠囊X2」對「金盞花葉黃素」），
 * 整串比對會一筆都找不到。這裡把搜尋字拆成小片段（中文每兩個字一組、英文數字整個字），
 * 依「有幾成片段對得上」排序，只要有一部分對上就列出來，最像的排最前面。
 */
export interface SearchableVariant { variant_name: string; sku_code: string | null }
export interface SearchableProduct { product_name: string; product_variants: SearchableVariant[] }

const CJK = /[㐀-鿿]/

/** 拿掉數量寫法（X2、×3、2瓶、3盒），這些不是商品名 */
export function cleanQuery(q: string): string {
  return q
    .replace(/[xX×*＊]\s*\d+/g, ' ')
    .replace(/\d+\s*(瓶|盒|包|罐|袋|組|入|個|條|份|件|顆|支|片)/g, ' ')
    .replace(/[，,、。;；:：()（）【】\[\]]/g, ' ')
    .trim()
}

export function queryTokens(q: string): string[] {
  const out: string[] = []
  for (const word of cleanQuery(q).toLowerCase().split(/\s+/).filter(Boolean)) {
    let cjk = ''
    let latin = ''
    const flushCjk = () => {
      if (cjk.length === 1) out.push(cjk)
      for (let i = 0; i + 1 < cjk.length; i++) out.push(cjk.slice(i, i + 2))
      cjk = ''
    }
    const flushLatin = () => { if (latin) out.push(latin); latin = '' }
    for (const ch of Array.from(word)) {
      if (CJK.test(ch)) { flushLatin(); cjk += ch } else { flushCjk(); latin += ch }
    }
    flushCjk(); flushLatin()
  }
  return [...new Set(out)]
}

/** 依符合程度排序後的商品；沒輸入時照原順序全部列出 */
export function searchCatalog<T extends SearchableProduct>(catalog: T[], query: string): T[] {
  const tokens = queryTokens(query)
  if (!tokens.length) return catalog
  return catalog
    .map((p, i) => {
      const hay = [p.product_name, ...p.product_variants.flatMap(v => [v.variant_name, v.sku_code || ''])].join(' ').toLowerCase()
      const hits = tokens.filter(t => hay.includes(t)).length
      return { p, i, score: hits / tokens.length }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(x => x.p)
}
