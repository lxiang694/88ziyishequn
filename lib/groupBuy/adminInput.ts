import { twLocalToIso } from './domain'

/**
 * 後台儲存檔期時的資料整理與檢查（純函式，可測試）。
 * 資料庫也有 CHECK 限制；這裡先擋下來，給後台看得懂的中文。
 */

export interface CampaignInput {
  slug: string
  title: string
  subtitle: string
  description: string
  cover_image_url: string | null
  starts_at: string
  ends_at: string
  ship_note: string
  ship_711_enabled: boolean
  ship_home_enabled: boolean
  fee_711: number
  fee_home: number
  free_shipping_threshold: number | null
  is_published: boolean
}

export interface ItemInput {
  id: number | null
  name: string
  spec: string
  description: string
  image_url: string | null
  price: number
  original_price: number | null
  per_person_limit: number | null
  total_quota: number | null
  sort_order: number
  is_active: boolean
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim() : '').slice(0, max)
const url = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https?:\/\/[^\s"'<>]+$/.test(s) && s.length <= 1000 ? s : null
}
/** 空白 → null；否則必須是範圍內的整數 */
function optInt(v: unknown, min: number, max: number): number | null | 'bad' {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : 'bad'
}

export function parseCampaignInput(body: any): { value?: CampaignInput; error?: string } {
  const title = str(body?.title, 80)
  if (!title) return { error: '請填寫檔期名稱' }
  const slug = str(body?.slug, 61).toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return { error: '網址代稱只能用小寫英文、數字與 -，例如 2026-11' }
  const starts_at = twLocalToIso(body?.starts_at_local)
  const ends_at = twLocalToIso(body?.ends_at_local)
  if (!starts_at || !ends_at) return { error: '請填寫開團與截單時間' }
  if (ends_at <= starts_at) return { error: '截單時間要晚於開團時間' }
  const ship_711_enabled = body?.ship_711_enabled === true
  const ship_home_enabled = body?.ship_home_enabled === true
  if (!ship_711_enabled && !ship_home_enabled) return { error: '至少要開一種取貨方式' }
  const fee_711 = optInt(body?.fee_711, 0, 5000)
  const fee_home = optInt(body?.fee_home, 0, 5000)
  const free = optInt(body?.free_shipping_threshold, 0, 1_000_000)
  if (fee_711 === 'bad' || fee_home === 'bad') return { error: '運費要是 0～5000 的整數' }
  if (free === 'bad') return { error: '免運門檻要是整數，不需要就留空' }
  return {
    value: {
      slug, title,
      subtitle: str(body?.subtitle, 200),
      description: str(body?.description, 5000),
      cover_image_url: url(body?.cover_image_url),
      starts_at, ends_at,
      ship_note: str(body?.ship_note, 200),
      ship_711_enabled, ship_home_enabled,
      fee_711: fee_711 ?? 0, fee_home: fee_home ?? 0, free_shipping_threshold: free,
      is_published: body?.is_published === true,
    },
  }
}

export function parseItemsInput(list: unknown): { value?: ItemInput[]; error?: string } {
  if (!Array.isArray(list)) return { value: [] }
  if (list.length > 50) return { error: '一檔最多 50 樣商品' }
  const out: ItemInput[] = []
  for (const [i, raw] of list.entries()) {
    const label = `第 ${i + 1} 樣商品`
    const name = str(raw?.name, 80)
    if (!name) return { error: `${label}：請填寫商品名稱` }
    const price = optInt(raw?.price, 1, 100_000)
    if (price === null || price === 'bad') return { error: `${label}「${name}」：團購價要是 1～100000 的整數` }
    const original = optInt(raw?.original_price, 1, 1_000_000)
    if (original === 'bad') return { error: `${label}「${name}」：原價要是整數，不需要就留空` }
    const limit = optInt(raw?.per_person_limit, 1, 999)
    if (limit === 'bad') return { error: `${label}「${name}」：每人限購要是 1～999，不限就留空` }
    const quota = optInt(raw?.total_quota, 1, 100_000)
    if (quota === 'bad') return { error: `${label}「${name}」：總量要是整數，不限就留空` }
    const id = raw?.id == null || raw?.id === '' ? null : Number(raw.id)
    if (id !== null && !(Number.isSafeInteger(id) && id > 0)) return { error: `${label}：資料不正確，請重新整理` }
    out.push({
      id, name, price,
      spec: str(raw?.spec, 60),
      description: str(raw?.description, 3000),
      image_url: url(raw?.image_url),
      original_price: original,
      per_person_limit: limit,
      total_quota: quota,
      sort_order: i,
      is_active: raw?.is_active !== false,
    })
  }
  return { value: out }
}
