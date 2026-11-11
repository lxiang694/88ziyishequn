import { Suspense } from 'react'
import { supabaseStorefront as db } from '@/lib/supabase'
import { buildSalesMap } from '@/lib/salesUtils'
import { nameSegments } from '@/lib/wordBreak'
import { pickTrending, TRENDING_DAYS, type TrendRow } from '@/lib/homeTrending'
import HomeClient from '@/components/front/HomeClient'
import { pickOpenEvent, type HomeEventRow } from '@/lib/homeEvent'
import { canDisplay, type HomeBanner } from '@/lib/homeBanner'
import { currentCampaign } from '@/lib/groupBuy/repo'
import type { HealthCategory } from '@/lib/types'

// 前台頁面每 60 秒重新產生一次，期間的訪客直接拿快取（從離客人最近的
// 節點送出），不再每次打開都查資料庫。後台改商品時會呼叫
// refreshStorefront() 讓快取立刻更新（lib/storefrontCache.ts）。
// 本頁的查詢必須走 supabaseStorefront：改回 supabaseAdmin（no-store）
// 這頁就會變回每次都查資料庫，revalidate 不再有作用。
export const revalidate = 60

/**
 * 最近 7 天每張訂單買了哪些商品（不含已取消），給第一屏「最近大家都在買」排名用。
 * 查不到（例如網路錯誤）就回空陣列，第一屏退回累計熱銷，不影響整頁。
 */
async function recentOrderRows(): Promise<TrendRow[]> {
  const since = new Date(Date.now() - TRENDING_DAYS * 86400_000).toISOString()
  const rows: TrendRow[] = []
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await db.from('order_items')
      .select('id, order_id, product_id, orders!inner(created_at, order_status)')
      .gte('orders.created_at', since)
      .neq('orders.order_status', '已取消')
      .order('id').range(from, from + 999)
    if (error || !data) return rows
    rows.push(...(data as any[]).map(r => ({ order_id: r.order_id, product_id: r.product_id })))
    if (data.length < 1000) break
  }
  return rows
}

async function getInitialData() {
  const [productsRes, categoriesRes, salesMap, eventsRes, bannerRes, groupBuy, recentRows] = await Promise.all([
    db
      .from('products')
      .select(`*,
        product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active),
        product_category_relations(health_categories(id, name, slug))`, { count: 'exact' })
      .eq('is_published', true)
      .limit(200),
    db
      .from('health_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    buildSalesMap(db),  // excludes cancelled orders automatically
    // 線下活動入口只在真的有開放報名的場次時顯示。查詢範圍很小
    // （只取啟用中的），而且這頁每 60 秒最多重新產生一次。
    db
      .from('community_events')
      .select('slug, title, event_time, is_active, starts_at')
      .eq('is_active', true)
      .limit(20),
    // 首頁橫幅。資料表還沒建好時這裡會拿到 error，下面就當成沒有橫幅，
    // 首頁照常顯示原本的四步驟區塊 —— 不該因為一個還沒跑的遷移就壞掉。
    db
      .from('home_banners')
      .select('image_url, alt_text, link_path, is_active')
      .eq('id', 1)
      .maybeSingle(),
    // 首頁搜尋框上方的「每月團購」橫幅要顯示這一檔的狀態
    currentCampaign(db).catch(() => null),
    recentOrderRows().catch(() => [] as TrendRow[]),
  ])

  // 把銷量直接附加到每件商品上
  const withSales = (productsRes.data || []).map((p: any) => ({
    ...p,
    sales_count: salesMap[p.id] || 0,
  }))

  // 銷量高的排前面
  const sorted = withSales.sort((a: any, b: any) => b.sales_count - a.sales_count)
  // 首頁第一屏的熱銷商品卡很窄：品名先斷好詞，換行才不會斷在詞中間（見 lib/wordBreak.ts）
  // 第一屏「最近大家都在買」：最近 7 天下單次數最多的三件（見 lib/homeTrending.ts）
  const hero = pickTrending(sorted, recentRows)
  const segmentIds = new Set([...hero.ids, ...sorted.slice(0, 12).map((p: any) => p.id)])
  for (const p of sorted) if (segmentIds.has(p.id)) p.name_segments = nameSegments(String(p.product_name || '').replace(/^【小莊代購】\s*/, ''))

  return {
    initialProducts: sorted,
    initialTotal: productsRes.count ?? sorted.length,
    categories: (categoriesRes.data || []) as HealthCategory[],
    openEvent: pickOpenEvent(eventsRes.data as HomeEventRow[] | null),
    banner: canDisplay(bannerRes.data as HomeBanner | null) ? (bannerRes.data as HomeBanner) : null,
    groupBuy,
    hero,
  }
}

export default async function HomePage() {
  const { initialProducts, initialTotal, categories, openEvent, banner, groupBuy, hero } = await getInitialData()
  return (
    <Suspense fallback={null}>
      <HomeClient
        initialProducts={initialProducts as any}
        initialTotal={initialTotal}
        categories={categories}
        openEvent={openEvent}
        banner={banner}
        groupBuy={groupBuy}
        hero={hero}
      />
    </Suspense>
  )
}
