import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminMiddleware'
import { allShopCategories } from '@/lib/shopCategoryRepo'

export const dynamic = 'force-dynamic'

/**
 * 後台用的商品分類清單。
 *
 * 讀不到（遷移還沒跑）時回傳 needsMigration，讓商品表單能明確告訴
 * 使用者「請先執行 migrations/shop_categories_schema.sql」，而不是
 * 顯示一個空的選取器讓人以為是壞掉了。
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const rows = await allShopCategories()
  if (rows === null) {
    return NextResponse.json({
      success: true, data: [], needsMigration: true,
      message: '商品分類資料表尚未建立，請先在 Supabase SQL Editor 執行 migrations/shop_categories_schema.sql',
    })
  }
  return NextResponse.json({ success: true, data: rows })
}
