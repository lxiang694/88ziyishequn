import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SHOP_CATEGORIES } from '@/lib/shopCategories'

export const dynamic = 'force-dynamic'

/**
 * 前台的商品分類清單。
 *
 * 讀不到資料表時回退到程式裡的那份清單（lib/shopCategories.ts）。
 * 分類是整個賣場的導覽骨架 —— 遷移還沒跑、或資料庫一時讀不到，
 * 寧可顯示正確的分類但點進去是空的，也不要整條導覽消失。
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('shop_categories')
    .select('id, slug, name, emoji, description, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error || !data?.length) {
    return NextResponse.json({
      success: true,
      // 只給前台要用的欄位；forms / keywords 是自動建議用的內部啟發式，
      // 沒有必要送到瀏覽器。id 給負數，避免跟真實資料列的 id 混淆。
      data: SHOP_CATEGORIES.map((c, i) => ({
        id: -(i + 1), slug: c.slug, name: c.name,
        emoji: c.emoji, description: c.description, sort_order: (i + 1) * 10,
      })),
      fallback: true,
    })
  }
  return NextResponse.json({ success: true, data })
}
