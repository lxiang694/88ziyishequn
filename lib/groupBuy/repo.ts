import { supabaseAdmin, supabaseStorefront } from '@/lib/supabase'
import { campaignPhase, type Campaign, type Item } from './domain'

type Db = typeof supabaseAdmin

// 用 *：檔期表沒有敏感欄位，而且新增欄位（例如 7-11 常溫）的 SQL 還沒執行時，
// 前台照樣能顯示，不會因為選了不存在的欄位整頁 404
const CAMPAIGN_COLUMNS = '*'
const ITEM_COLUMNS = 'id, campaign_id, name, spec, description, image_url, price, original_price, per_person_limit, total_quota, sort_order, is_active'

export type PublicItem = Item & { sold: number; remaining: number | null }
export interface PublicCampaign { campaign: Campaign; items: PublicItem[]; buyers: number }

/** 各商品已售件數（不含已取消） */
export async function soldByItem(itemIds: number[], db: Db = supabaseAdmin): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (!itemIds.length) return out
  const { data } = await db.from('group_buy_item_stats').select('item_id, sold').in('item_id', itemIds)
  for (const r of (data || []) as any[]) out.set(Number(r.item_id), Number(r.sold) || 0)
  return out
}

/**
 * 前台團購頁要的資料：已發布的檔期、上架中的商品、各商品已售與剩餘、跟團人數。
 * 預設走快取 60 秒的用戶端（前台頁面）；下單 API 不用這個，下單時資料庫會即時檢查。
 */
export async function loadPublicCampaign(slug: string, db: Db = supabaseStorefront): Promise<PublicCampaign | null> {
  const { data: campaign } = await db.from('group_buy_campaigns').select(CAMPAIGN_COLUMNS)
    .eq('slug', slug).eq('is_published', true).maybeSingle()
  if (!campaign) return null
  const { data: items } = await db.from('group_buy_items').select(ITEM_COLUMNS)
    .eq('campaign_id', (campaign as any).id).eq('is_active', true).order('sort_order').order('id')
  const list = (items || []) as Item[]
  const [sold, stats] = await Promise.all([
    soldByItem(list.map(i => i.id), db),
    db.from('group_buy_campaign_stats').select('buyers').eq('campaign_id', (campaign as any).id).maybeSingle(),
  ])
  return {
    campaign: campaign as Campaign,
    items: list.map(i => {
      const s = sold.get(i.id) || 0
      return { ...i, sold: s, remaining: i.total_quota == null ? null : Math.max(i.total_quota - s, 0) }
    }),
    buyers: Number((stats.data as any)?.buyers) || 0,
  }
}

/**
 * /group-buy 要導去哪一檔：開團中的優先（多檔同時開時取最早截單的），
 * 沒有就取最近要開的預告，再沒有就取最近一檔已截單的（讓人看得到「下次開團」的說明）。
 */
export type CampaignTeaser = Pick<Campaign, 'slug' | 'title' | 'starts_at' | 'ends_at' | 'is_published'> & { banner_image_url?: string | null }

export async function currentCampaign(db: Db = supabaseStorefront, now = new Date()): Promise<CampaignTeaser | null> {
  const query = (cols: string) => db.from('group_buy_campaigns').select(cols)
    .eq('is_published', true).order('starts_at', { ascending: false }).limit(50)
  let { data, error } = await query('slug, title, starts_at, ends_at, is_published, banner_image_url')
  // 還沒執行 migrations/group_buy_banner_image.sql：沒有背景圖欄位，照舊讀其他欄位
  if (error) ({ data, error } = await query('slug, title, starts_at, ends_at, is_published'))
  if (error) return null   // 資料表還沒建立時當成沒有團購，頁面照常顯示
  const list = (data || []) as unknown as CampaignTeaser[]
  const by = (phase: string) => list.filter(c => campaignPhase(c, now) === phase)
  const open = by('open').sort((a, b) => a.ends_at.localeCompare(b.ends_at))[0]
  if (open) return open
  const upcoming = by('upcoming').sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  if (upcoming) return upcoming
  return by('closed')[0] ?? null
}

export async function currentCampaignSlug(db: Db = supabaseStorefront, now = new Date()): Promise<string | null> {
  return (await currentCampaign(db, now))?.slug ?? null
}
