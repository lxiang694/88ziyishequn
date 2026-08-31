import type { ReactNode } from 'react'
import { cache } from 'react'
import FrontShell from '@/components/front/FrontShell'
import TrafficTracker from '@/components/front/TrafficTracker'
import PresalePopup from '@/components/front/PresalePopup'
import { supabaseAdmin } from '@/lib/supabase'
import { PRESALE } from '@/lib/presale/camelliaOil'

/**
 * 彈窗要用的封面圖。
 *
 * 只在彈窗開著的時候才查 —— 預售結束把 enabled 關掉之後，
 * 這個查詢就完全不會發生，不會白白拖慢每一頁。
 */
const getPresaleCover = cache(async (): Promise<string | null> => {
  if (!PRESALE.popup.enabled) return null
  try {
    const { data } = await supabaseAdmin
      .from('products')
      .select('cover_image_url')
      .eq('slug', PRESALE.productSlug)
      .eq('is_published', true)
      .maybeSingle()
    return (data as any)?.cover_image_url ?? null
  } catch {
    // 查不到就不放圖，彈窗照樣能顯示
    return null
  }
})

export default async function FrontLayout({ children }: { children: ReactNode }) {
  const cover = await getPresaleCover()

  return (
    <>
      <TrafficTracker />
      <FrontShell>{children}</FrontShell>
      <PresalePopup coverImage={cover} />
    </>
  )
}
