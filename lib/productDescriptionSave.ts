import { supabaseAdmin } from '@/lib/supabase'
import { splitSections, sectionsToLegacy } from '@/lib/productSections'

/**
 * 商品介紹整篇貼上（description）：依小標題拆開，同時寫回舊欄位。
 * products 還沒有 description 欄位（沒執行 migrations/product_description.sql）時只寫舊欄位，
 * 前台照樣能用舊欄位組回整篇顯示。
 */
export async function descriptionUpdate(description: unknown): Promise<{ fields: Record<string, string | null>; columnReady: boolean }> {
  const text = typeof description === 'string' ? description.trim() : ''
  const legacy = sectionsToLegacy(splitSections(text))
  const { error } = await supabaseAdmin.from('products').select('description').limit(0)
  const columnReady = !error
  return { fields: { ...legacy, ...(columnReady ? { description: text || null } : {}) }, columnReady }
}
