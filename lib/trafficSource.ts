/**
 * 流量來源分析（純函式，可測試）。
 *
 * 判斷順序：
 *   1. 網址上的 utm_source（自己分享出去的連結加的標記，最準）
 *   2. 來源網址（Google、Facebook… 會帶）
 *   3. App 內建瀏覽器（LINE、Facebook、Instagram 開連結時常常不帶來源網址，
 *      但瀏覽器識別字串會寫 Line/、FBAN…，靠這個認出來）
 *   4. 都沒有 → 直接造訪（打網址、書籤、其他 App）
 *
 * 只算「進站」那一次：同一位訪客 30 分鐘內在站內點的頁面屬於同一次造訪，
 * 不重複計算來源。
 */
export type SourceKey =
  | 'google' | 'yahoo' | 'search' | 'facebook' | 'instagram' | 'line' | 'threads' | 'youtube'
  | 'referral' | 'other' | 'direct'

export const SOURCE_LABEL: Record<SourceKey, string> = {
  google: 'Google 搜尋', yahoo: 'Yahoo 搜尋', search: '其他搜尋引擎',
  facebook: 'Facebook', instagram: 'Instagram', line: 'LINE', threads: 'Threads', youtube: 'YouTube',
  referral: '親友推薦', other: '其他網站', direct: '直接造訪',
}

export interface ViewRow {
  visitor_id: string | null; path: string; created_at: string
  referrer?: string | null; user_agent?: string | null
  utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null
}

const SESSION_GAP_MS = 30 * 60_000

function hostOf(referrer: string): string {
  try {
    const url = new URL(referrer)
    return (url.hostname || url.host).toLowerCase()
  } catch {
    return ''
  }
}

const bare = (host: string) => host.replace(/^www\./, '')

export function isInternalHost(host: string, siteHost: string): boolean {
  return !!host && (bare(host) === bare(siteHost) || host.endsWith('.vercel.app') || host === 'localhost')
}

function fromUtm(value: string): SourceKey | null {
  const v = value.toLowerCase()
  if (v === 'referral') return 'referral'
  if (v.startsWith('line')) return 'line'
  if (v === 'fb' || v.startsWith('facebook')) return 'facebook'
  if (v === 'ig' || v.startsWith('instagram')) return 'instagram'
  if (v.startsWith('google')) return 'google'
  if (v.startsWith('yahoo')) return 'yahoo'
  if (v.startsWith('threads')) return 'threads'
  if (v === 'yt' || v.startsWith('youtube')) return 'youtube'
  return null
}

function fromHost(host: string): SourceKey | null {
  const h = bare(host)
  if (/(^|\.)google\.[a-z.]+$/.test(h) || h.includes('googlequicksearchbox')) return 'google'
  if (/(^|\.)yahoo\.(com|co\.jp|com\.tw)$/.test(h) || h.endsWith('.yahoo.com')) return 'yahoo'
  if (/(^|\.)(bing\.com|duckduckgo\.com|baidu\.com|ecosia\.org|naver\.com|search\.brave\.com)$/.test(h)) return 'search'
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(h)) return 'facebook'
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram'
  if (/(^|\.)(line\.me|line\.naver\.jp|lin\.ee)$/.test(h)) return 'line'
  if (/(^|\.)threads\.(net|com)$/.test(h)) return 'threads'
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube'
  return null
}

function fromUserAgent(ua: string): SourceKey | null {
  if (/Instagram/.test(ua)) return 'instagram'
  if (/Barcelona/.test(ua)) return 'threads'      // Threads App 的內建瀏覽器
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return 'facebook'
  if (/\bLine\//.test(ua)) return 'line'
  return null
}

/** 一次進站的來源；detail 是「其他網站」要顯示的網域或 utm 名稱 */
export function classifySource(row: ViewRow, siteHost: string): { key: SourceKey; detail: string } {
  const utm = (row.utm_source || '').trim()
  if (utm) return { key: fromUtm(utm) || 'other', detail: utm.toLowerCase() }

  const host = hostOf(row.referrer || '')
  if (host && !isInternalHost(host, siteHost)) {
    return { key: fromHost(host) || 'other', detail: bare(host) }
  }
  return { key: fromUserAgent(row.user_agent || '') || 'direct', detail: '' }
}

/** 外部來源網址（站內換頁帶的是自己的網址，不算） */
function externalReferrer(row: ViewRow, siteHost: string): string {
  const host = hostOf(row.referrer || '')
  return host && !isInternalHost(host, siteHost) ? host : ''
}

/**
 * 找出每一次「進站」：同一位訪客距離上一頁超過 30 分鐘，或換了外部來源／utm，
 * 就算新的一次造訪。rows 需依 created_at 由舊到新排序。
 */
export function entryViews(rows: ViewRow[], siteHost: string): ViewRow[] {
  const last = new Map<string, { at: number; ref: string; utm: string }>()
  const entries: ViewRow[] = []
  for (const r of rows) {
    const at = new Date(r.created_at).getTime()
    const ref = externalReferrer(r, siteHost)
    const utm = (r.utm_source || '').trim().toLowerCase()
    if (!r.visitor_id) { entries.push(r); continue }
    const prev = last.get(r.visitor_id)
    const isNew = !prev || at - prev.at > SESSION_GAP_MS || (ref && ref !== prev.ref) || (utm && utm !== prev.utm)
    if (isNew) {
      entries.push(r)
      last.set(r.visitor_id, { at, ref, utm })
    } else {
      prev.at = at
    }
  }
  return entries
}

export interface SourceStat {
  key: SourceKey; label: string; visits: number; visitors: number; share: number
  landings: { path: string; visits: number }[]
}

export function summarizeSources(rows: ViewRow[], siteHost: string) {
  const entries = entryViews(rows, siteHost)
  const stats = new Map<SourceKey, { visits: number; visitors: Set<string>; landings: Map<string, number> }>()
  const otherSites = new Map<string, number>()
  const campaigns = new Map<string, { source: string; medium: string; campaign: string; visits: number }>()

  for (const e of entries) {
    const { key, detail } = classifySource(e, siteHost)
    const s = stats.get(key) || { visits: 0, visitors: new Set<string>(), landings: new Map<string, number>() }
    s.visits++
    if (e.visitor_id) s.visitors.add(e.visitor_id)
    s.landings.set(e.path, (s.landings.get(e.path) || 0) + 1)
    stats.set(key, s)
    if (key === 'other' && detail) otherSites.set(detail, (otherSites.get(detail) || 0) + 1)

    const source = (e.utm_source || '').trim().toLowerCase()
    if (source) {
      const medium = (e.utm_medium || '').trim().toLowerCase()
      const campaign = (e.utm_campaign || '').trim()
      const id = `${source}\u0000${medium}\u0000${campaign}`
      const c = campaigns.get(id) || { source, medium, campaign, visits: 0 }
      c.visits++
      campaigns.set(id, c)
    }
  }

  const total = entries.length
  const sources: SourceStat[] = [...stats.entries()]
    .map(([key, s]) => ({
      key, label: SOURCE_LABEL[key], visits: s.visits, visitors: s.visitors.size,
      share: total ? s.visits / total : 0,
      landings: [...s.landings.entries()].map(([path, visits]) => ({ path, visits }))
        .sort((a, b) => b.visits - a.visits).slice(0, 5),
    }))
    .sort((a, b) => b.visits - a.visits)

  return {
    total_visits: total,
    sources,
    other_sites: [...otherSites.entries()].map(([name, visits]) => ({ name, visits }))
      .sort((a, b) => b.visits - a.visits).slice(0, 10),
    campaigns: [...campaigns.values()].sort((a, b) => b.visits - a.visits).slice(0, 20),
  }
}

/** 前台：從網址取出 utm 標記（只留常用三個，長度有上限） */
export function utmFromSearch(search: string): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  const params = new URLSearchParams(search)
  const out: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const v = (params.get(key) || '').trim().slice(0, 100)
    if (v) out[key] = v
  }
  // 親友推薦連結只有 ?ref=推薦碼：沒有其他標記時記成「親友推薦」，活動欄放推薦碼
  const ref = (params.get('ref') || '').trim().toUpperCase().slice(0, 10)
  if (ref && !out.utm_source) { out.utm_source = 'referral'; out.utm_medium = 'friend'; out.utm_campaign = ref }
  return out
}
