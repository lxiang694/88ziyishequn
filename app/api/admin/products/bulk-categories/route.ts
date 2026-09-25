import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { normalizeCategoryIds, suggestShopCategories } from '@/lib/shopCategories'
import { saveShopCategories, shopCategoriesByProduct, allShopCategories } from '@/lib/shopCategoryRepo'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const MAX_PER_REQUEST = 100

function requireProductPerm(req: NextRequest) {
  const result = requireAdmin(req)
  if (result instanceof NextResponse) return result
  const { admin } = result
  if (!admin.permissions.includes('all') && !admin.permissions.includes('products.all')) {
    return NextResponse.json({ success: false, error: '無商品管理權限' }, { status: 403 })
  }
  return { admin }
}

/**
 * 批次指派畫面的資料：所有商品 ＋ 目前的分類 ＋ 自動建議。
 *
 * 站上既有商品都還沒有商品分類，一件一件進編輯頁補太慢。這支把整批
 * 撈出來，順便依商品名稱算好建議，讓使用者一路按下去就好。
 *
 * 建議只是建議 —— 這支不會自己寫進資料庫。分錯類客人就找不到商品，
 * 那個代價不該由一段關鍵字比對決定。
 */
export async function GET(req: NextRequest) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth

  const onlyUnassigned = new URL(req.url).searchParams.get('unassigned') === '1'

  const categories = await allShopCategories()
  if (categories === null) {
    return NextResponse.json({
      success: false,
      error: '商品分類資料表尚未建立，請先在 Supabase SQL Editor 執行 migrations/shop_categories_schema.sql',
    }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, product_name, short_intro, ingredients, cover_image_url, is_published')
    .order('is_published', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const bySlug = new Map(categories.map(c => [c.slug, c.id]))
  const assigned = await shopCategoriesByProduct((data || []).map(p => p.id))

  const rows = (data || []).map(p => {
    const current = assigned.get(p.id) || []
    return {
      id: p.id,
      product_name: p.product_name,
      cover_image_url: p.cover_image_url,
      is_published: p.is_published,
      category_ids: current.map(c => c.id),
      // 已經有分類的就不再給建議，免得干擾人工判斷
      suggestions: current.length > 0 ? [] : suggestShopCategories(p)
        .map(s => ({ id: bySlug.get(s.slug), matched: s.matched.slice(0, 3) }))
        .filter((s): s is { id: number; matched: string[] } => typeof s.id === 'number'),
    }
  })

  return NextResponse.json({
    success: true,
    categories,
    data: onlyUnassigned ? rows.filter(r => r.category_ids.length === 0) : rows,
  })
}

/**
 * 一次存多件商品的分類。
 *
 * 只動 product_shop_category_relations，不碰商品本身的任何欄位 ——
 * 這個畫面的職責就只有分類。
 */
export async function PUT(req: NextRequest) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    if (!Array.isArray(body.assignments)) {
      return NextResponse.json({ success: false, error: '資料格式不正確' }, { status: 400 })
    }
    if (body.assignments.length > MAX_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `一次最多存 ${MAX_PER_REQUEST} 件，請分批` }, { status: 400 })
    }

    const failed: number[] = []
    let saved = 0
    for (const row of body.assignments) {
      const productId = Number(row?.product_id)
      if (!Number.isInteger(productId) || productId <= 0) { failed.push(productId); continue }
      const ok = await saveShopCategories(productId, normalizeCategoryIds(row?.category_ids))
      if (ok) saved++
      else failed.push(productId)
    }

    await writeAuditLog(req, auth.admin, 'products.bulk_categories', `saved=${saved};failed=${failed.length}`)

    if (failed.length > 0) {
      return NextResponse.json({
        success: false, saved,
        error: `${saved} 件已存，${failed.length} 件失敗（商品 ${failed.slice(0, 5).join('、')}）`,
      }, { status: 500 })
    }
    return NextResponse.json({ success: true, saved })
  } catch {
    return NextResponse.json({ success: false, error: '儲存失敗' }, { status: 500 })
  }
}
