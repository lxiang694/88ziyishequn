import { Suspense } from 'react'
import { supabaseStorefront as db } from '@/lib/supabase'
import { buildSalesMap } from '@/lib/salesUtils'
import HomeClient from '@/components/front/HomeClient'
import { pickOpenEvent, type HomeEventRow } from '@/lib/homeEvent'
import { canDisplay, type HomeBanner } from '@/lib/homeBanner'
import type { HealthCategory } from '@/lib/types'

// 前台頁面每 60 秒重新產生一次，期間的訪客直接拿快取（從離客人最近的
// 節點送出），不再每次打開都查資料庫。後台改商品時會呼叫
// refreshStorefront() 讓快取立刻更新（lib/storefrontCache.ts）。
// 本頁的查詢必須走 supabaseStorefront：改回 supabaseAdmin（no-store）
// 這頁就會變回每次都查資料庫，revalidate 不再有作用。
export const revalidate = 60

async function getInitialData() {
  const [productsRes, categoriesRes, salesMap, eventsRes, bannerRes] = await Promise.all([
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
  ])

  // 把銷量直接附加到每件商品上
  const withSales = (productsRes.data || []).map((p: any) => ({
    ...p,
    sales_count: salesMap[p.id] || 0,
  }))

  // 銷量高的排前面
  const sorted = withSales.sort((a: any, b: any) => b.sales_count - a.sales_count)

  return {
    initialProducts: sorted,
    initialTotal: productsRes.count ?? sorted.length,
    categories: (categoriesRes.data || []) as HealthCategory[],
    openEvent: pickOpenEvent(eventsRes.data as HomeEventRow[] | null),
    banner: canDisplay(bannerRes.data as HomeBanner | null) ? (bannerRes.data as HomeBanner) : null,
  }
}

export default async function HomePage() {
  const { initialProducts, initialTotal, categories, openEvent, banner } = await getInitialData()
  return (
    <Suspense fallback={null}>
      <HomeClient
        initialProducts={initialProducts as any}
        initialTotal={initialTotal}
        categories={categories}
        openEvent={openEvent}
        banner={banner}
      />
    </Suspense>
  )
}
