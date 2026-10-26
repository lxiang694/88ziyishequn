import { shopCategoryBySlug } from './shopCategories'

/**
 * 把網址路徑翻成看得懂的中文頁名（後台流量監控用，純函式可測試）。
 *
 *   /                         → 首頁
 *   /products/msm             → 商品：MSM 甲基硫醯基甲烷（查得到名稱時）
 *   /shop/nutrition           → 商品分類：營養支持
 *   /health-articles/xxx      → 健康知識：文章標題
 *
 * 商品、文章、團購、活動的名稱由呼叫端從資料庫查好傳進來（names）。
 */
export type PageKind = 'products' | 'health-articles' | 'group-buy' | 'events'

export interface PageNames {
  products?: Map<string, string>
  'health-articles'?: Map<string, string>
  'group-buy'?: Map<string, string>
  events?: Map<string, string>
}

const STATIC: Record<string, string> = {
  '/': '首頁',
  '/shop': '全部商品',
  '/shop/new': '新品上市',
  '/cart': '購物車',
  '/checkout': '結帳',
  '/order-success': '下單成功',
  '/orders': '訂單查詢',
  '/account': '會員中心',
  '/account/orders': '會員中心：我的訂單',
  '/account/addresses': '會員中心：收件地址',
  '/account/profile': '會員中心：個人資料',
  '/login': '會員登入',
  '/signup': '會員註冊',
  '/forgot-password': '忘記密碼',
  '/reset-password': '重設密碼',
  '/health-articles': '健康知識（文章列表）',
  '/health-quiz': '健康檢測',
  '/health-quiz/result': '健康檢測：結果',
  '/sleep-quiz': '睡眠檢測',
  '/sleep-quiz/start': '睡眠檢測：開始',
  '/sleep-quiz/result': '睡眠檢測：結果',
  '/sleep-quiz/psqi': '睡眠品質量表（PSQI）',
  '/sleep-quiz/psqi/result': '睡眠品質量表：結果',
  '/sleep-quiz/ess': '嗜睡量表（ESS）',
  '/sleep-quiz/ess/result': '嗜睡量表：結果',
  '/sleep-tracker': '睡眠紀錄',
  '/camellia-oil': '苦茶油專區',
  '/group-buy': '團購',
  '/events': '社群活動',
}

const PREFIX: Record<PageKind, string> = {
  products: '商品',
  'health-articles': '健康知識',
  'group-buy': '團購',
  events: '社群活動',
}

function decode(s: string): string {
  try { return decodeURIComponent(s) } catch { return s }
}

/** 拆出「/商品類型/代稱」；不是這幾種就回 null */
export function slugOf(path: string): { kind: PageKind; slug: string } | null {
  const m = /^\/(products|health-articles|group-buy|events)\/(.+?)\/?$/.exec(path)
  return m ? { kind: m[1] as PageKind, slug: decode(m[2]) } : null
}

export function pageLabel(path: string, names: PageNames = {}): string {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  if (STATIC[clean]) return STATIC[clean]

  const shop = /^\/shop\/([^/]+)$/.exec(clean)
  if (shop) {
    const c = shopCategoryBySlug(decode(shop[1]))
    return c ? `商品分類：${c.name}` : '商品分類'
  }

  const s = slugOf(clean)
  if (s) {
    const name = names[s.kind]?.get(s.slug)
    return name ? `${PREFIX[s.kind]}：${name}` : `${PREFIX[s.kind]}（已刪除或網址已變更）`
  }
  return decode(clean)
}

/** 從一堆路徑裡整理出要查名稱的代稱 */
export function slugsToLookup(paths: string[]): Record<PageKind, string[]> {
  const out: Record<PageKind, Set<string>> = {
    products: new Set(), 'health-articles': new Set(), 'group-buy': new Set(), events: new Set(),
  }
  for (const p of paths) {
    const s = slugOf(p.length > 1 ? p.replace(/\/+$/, '') : p)
    if (s) out[s.kind].add(s.slug)
  }
  return {
    products: [...out.products], 'health-articles': [...out['health-articles']],
    'group-buy': [...out['group-buy']], events: [...out.events],
  }
}
