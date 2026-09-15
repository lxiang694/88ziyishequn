import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { QUICK_ORDER_PERMISSION } from '@/lib/quickOrder/domain'

/**
 * GET /api/admin/quick-order/catalog
 *
 * 手動挑商品用的清單。一次load完，之後在畫面上即時篩選 ——
 * 邊打字邊送查詢在這個規模只會更慢，而且代客下單的時候
 * 客戶還在線上等，不能有等待感。
 *
 * 只回下單需要的欄位。
 */
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, QUICK_ORDER_PERMISSION)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, product_name, cover_image_url, is_published, product_variants(id,variant_name,sale_price,stock_qty,sku_code,is_active,sort_order)')
    .eq('is_published', true)
    .order('product_name', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[quick-order/catalog] failed', error)
    return NextResponse.json({ success: false, error: '讀取商品失敗' }, { status: 500 })
  }

  // 已下架的規格不該出現在可選清單裡；沒有任何可選規格的商品整個拿掉
  const rows = (data || [])
    .map((p: any) => ({
      ...p,
      product_variants: (p.product_variants || [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))
    .filter((p: any) => p.product_variants.length > 0)

  return NextResponse.json({ success: true, data: rows })
}
