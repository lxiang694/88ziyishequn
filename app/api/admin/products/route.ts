import { NextRequest, NextResponse } from 'next/server'
import { cleanImageUrl } from '@/lib/productVariants'
import { variantImagesReady, VARIANT_IMAGES_SQL_HINT } from '@/lib/variantImages'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { generateSlug, normalizeSlug } from '@/lib/utils'
import { HOME_SECTION_KEYS } from '@/lib/homeSections'
import { normalizeCategoryIds } from '@/lib/shopCategories'
import { saveShopCategories, shopCategoriesByProduct } from '@/lib/shopCategoryRepo'
import { refreshStorefront } from '@/lib/storefrontCache'
import { needsRestock } from '@/lib/adminStock'

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('products.all')) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const published = searchParams.get('published') || ''
  // stock=low：只看有規格庫存不足（少於 5 件，含售完）的商品
  const stockFilter = searchParams.get('stock') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '15')
  const offset = (page - 1) * limit

  // DB-level category filter
  let productIdFilter: number[] | null = null
  if (category) {
    const { data: relations } = await supabaseAdmin
      .from('product_category_relations')
      .select('product_id')
      .eq('category_id', parseInt(category))
    productIdFilter = (relations || []).map((r: any) => r.product_id)
    if (productIdFilter.length === 0) {
      return NextResponse.json({ success: true, data: [], total: 0, page, limit })
    }
  }

  // 封存的商品（已有訂單、按過刪除）平常不顯示，選「已封存」才看得到。
  // products_archive.sql 還沒執行時沒有 archived_at 欄位，不加這個條件。
  const { error: archiveProbe } = await supabaseAdmin.from('products').select('archived_at').limit(0)

  // 頁面上方的摘要（全部／上架中／未上架／庫存不足）＋「只看庫存不足」要用的商品編號。
  // 只讀狀態與規格庫存，商品數百件的量級一次讀完沒問題。
  let summaryQuery = supabaseAdmin.from('products').select('id, is_published, product_variants(stock_qty, is_active)').limit(2000)
  if (!archiveProbe) summaryQuery = summaryQuery.is('archived_at', null)
  const { data: allRows } = await summaryQuery
  const lowIds = (allRows || []).filter((p: any) => needsRestock(p.product_variants)).map((p: any) => p.id as number)
  const summary = {
    all: allRows?.length || 0,
    published: (allRows || []).filter((p: any) => p.is_published).length,
    unpublished: (allRows || []).filter((p: any) => !p.is_published).length,
    lowStock: lowIds.length,
  }
  if (stockFilter === 'low') {
    productIdFilter = productIdFilter === null ? lowIds : productIdFilter.filter(id => lowIds.includes(id))
    if (productIdFilter.length === 0) return NextResponse.json({ success: true, data: [], total: 0, page, limit, summary })
  }

  let query = supabaseAdmin
    .from('products')
    .select(`*, product_variants(*), product_images(id,image_url,sort_order), product_category_relations(health_categories(id,name,slug))`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) query = query.ilike('product_name', `%${search}%`)
  if (!archiveProbe) query = published === 'archived' ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (published === 'true') query = query.eq('is_published', true)
  if (published === 'false') query = query.eq('is_published', false)
  if (productIdFilter !== null) query = query.in('id', productIdFilter)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // 商品分類另外查再貼回去，遷移還沒跑時只是少一塊標籤，不會讓整頁掛掉
  const shopByProduct = await shopCategoriesByProduct((data || []).map((p: any) => p.id))
  const rows = (data || []).map((p: any) => ({ ...p, shop_categories: shopByProduct.get(p.id) || [] }))

  return NextResponse.json({ success: true, data: rows, total: count || 0, page, limit, summary })
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('products.all')) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const { product_name, slug: rawSlug, short_intro, suitable_people, usage_method, ingredients, precautions, storage_method, is_published, cover_image_url, home_section, intake_timing, pairing_tips, source_notes, category_ids, shop_category_ids, variants, gallery_images } = body
    if (!product_name) return NextResponse.json({ success: false, error: '商品名稱為必填' }, { status: 400 })

    // 自訂網址識別碼；沒填或整理後是空的就退回自動產生
    const custom = normalizeSlug(rawSlug)
    const slug = custom || generateSlug(product_name)
    if (custom) {
      const { data: dup } = await supabaseAdmin
        .from('products').select('id').eq('slug', custom).maybeSingle()
      if (dup) {
        return NextResponse.json(
          { success: false, error: `網址識別碼「${custom}」已經被其他商品使用了` }, { status: 409 })
      }
    }
    const { data: product, error: pe } = await supabaseAdmin
      .from('products')
      .insert({ product_name, slug, short_intro: short_intro || null, suitable_people: suitable_people || null, usage_method: usage_method || null, ingredients: ingredients || null, precautions: precautions || null, storage_method: storage_method || null, is_published: !!is_published, cover_image_url: cover_image_url || null, home_section: HOME_SECTION_KEYS.includes(home_section) ? home_section : 'community', intake_timing: intake_timing || null, pairing_tips: pairing_tips || null, source_notes: source_notes || null })
      .select().single()
    if (pe) return NextResponse.json({ success: false, error: pe.message }, { status: 500 })
    if (category_ids?.length > 0) {
      await supabaseAdmin.from('product_category_relations').insert(category_ids.map((cid: number) => ({ product_id: product.id, category_id: cid })))
    }
    await saveShopCategories(product.id, normalizeCategoryIds(shop_category_ids))
    let imagesSkipped = false
    if (variants?.length > 0) {
      // 規格圖片：資料庫還沒有欄位時先不存圖，其他照常（見 lib/variantImages.ts）
      const withImages = await variantImagesReady()
      imagesSkipped = !withImages && variants.some((v: any) => cleanImageUrl(v?.image_url))
      await supabaseAdmin.from('product_variants').insert(variants.map((v: any, i: number) => ({
        product_id: product.id, variant_name: v.variant_name, sale_price: parseFloat(v.sale_price),
        original_price: v.original_price ? parseFloat(v.original_price) : null,
        stock_qty: parseInt(v.stock_qty) || 0, sku_code: v.sku_code || null, sort_order: i, is_active: v.is_active !== false,
        ...(withImages ? { image_url: cleanImageUrl(v.image_url) } : {}),
      })))
    }
    if (gallery_images?.length > 0) {
      await supabaseAdmin.from('product_images').insert(gallery_images.map((img: any, i: number) => ({
        product_id: product.id, image_url: typeof img === 'string' ? img : img.image_url, sort_order: i,
      })))
    }
    refreshStorefront()
    return NextResponse.json({ success: true, data: product, ...(imagesSkipped ? { notice: VARIANT_IMAGES_SQL_HINT } : {}) })
  } catch {
    return NextResponse.json({ success: false, error: '新增商品失敗' }, { status: 500 })
  }
}
