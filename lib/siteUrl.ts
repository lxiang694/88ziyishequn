/**
 * 網站的正式網址 —— 全站唯一來源。
 *
 * ⚠️ 這個值會出現在 canonical、og:url、sitemap.xml 與 robots.txt 裡，
 *    是告訴 Google「這個網站真正的位址是哪一個」的地方。
 *
 * 原本 13 個檔案各自寫死 'https://healthec.vercel.app'，也就是 Vercel
 * 的部署網址。但實際營運的網域是 www.88ziyishequn.com，兩個網域服務
 * 同一份內容 —— 於是每一頁都在對 Google 說「我的正式版本在
 * healthec.vercel.app」。結果是搜尋排名的權重全部歸到那個部署網址上，
 * 品牌網域等於白做。
 *
 * 之後要換網域只要改環境變數，不必動程式碼。設定在 Vercel 的
 * Environment Variables：NEXT_PUBLIC_SITE_URL
 */
const FALLBACK = 'https://www.88ziyishequn.com'

export function normalizeSiteUrl(value: string | undefined): string {
  const raw = (value || '').trim()
  if (!raw) return FALLBACK
  // 結尾的斜線會讓組出來的網址變成 //products/xxx
  const withoutSlash = raw.replace(/\/+$/, '')
  // 只接受 http(s)，避免設錯值(«example.com») 產生壞掉的 canonical
  if (!/^https?:\/\/[^/]+$/.test(withoutSlash)) return FALLBACK
  return withoutSlash
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)

/** 組出站內絕對網址。path 需以 / 開頭。 */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
