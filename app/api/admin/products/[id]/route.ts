import { NextRequest, NextResponse } from 'next/server'
import { normalizeSlug } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { HOME_SECTION_KEYS } from '@/lib/homeSections'
import { normalizeCategoryIds } from '@/lib/shopCategories'
import { saveShopCategories, shopCategoriesByProduct } from '@/lib/shopCategoryRepo'
import { refreshStorefront } from '@/lib/storefrontCache'

function requireProductPerm(req: NextRequest) {
  const result = requireAdmin(req)
  if (result instanceof NextResponse) return result
  const { admin } = result
  if (!admin.permissions.includes('all') && !admin.permissions.includes('products.all')) {
    return NextResponse.json({ success: false, error: '無商品管理權限' }, { status: 403 })
  }
  return { admin }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`*, product_variants(id,variant_name,sale_price,original_price,stock_qty,sku_code,sort_order,is_active), product_images(id,image_url,sort_order), product_category_relations(health_categories(id,name,slug))`)
    .eq('id', params.id).single()
  if (error) return NextResponse.json({ success: false, error: '商品不存在' }, { status: 404 })

  const shop = await shopCategoriesByProduct([data.id])
  return NextResponse.json({ success: true, data: { ...data, shop_categories: shop.get(data.id) || [] } })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { product_name, slug: rawSlug, short_intro, suitable_people, usage_method, ingredients,
            precautions, storage_method, is_published, cover_image_url, home_section,
            intake_timing, pairing_tips, source_notes,
            category_ids, shop_category_ids, variants, gallery_images } = body
    const productId = parseInt(params.id)

    // Build update object - only include defined fields
    const updateData: any = {}
    if (product_name !== undefined) updateData.product_name = product_name
    // 網址識別碼可以改，但改了舊網址就會失效，所以只在真的有填時才動
    if (rawSlug !== undefined) {
      const custom = normalizeSlug(rawSlug)
      if (custom) {
        const { data: dup } = await supabaseAdmin
          .from('products').select('id').eq('slug', custom).maybeSingle()
        if (dup && dup.id !== productId) {
          return NextResponse.json(
            { success: false, error: `網址識別碼「${custom}」已經被其他商品使用了` }, { status: 409 })
        }
        updateData.slug = custom
      }
    }
    if (home_section !== undefined) updateData.home_section = HOME_SECTION_KEYS.includes(home_section) ? home_section : 'community'
    if (intake_timing !== undefined) updateData.intake_timing = intake_timing || null
    if (pairing_tips !== undefined) updateData.pairing_tips = pairing_tips || null
    if (source_notes !== undefined) updateData.source_notes = source_notes || null
    if (short_intro !== undefined) updateData.short_intro = short_intro || null
    if (suitable_people !== undefined) updateData.suitable_people = suitable_people || null
    if (usage_method !== undefined) updateData.usage_method = usage_method || null
    if (ingredients !== undefined) updateData.ingredients = ingredients || null
    if (precautions !== undefined) updateData.precautions = precautions || null
    if (storage_method !== undefined) updateData.storage_method = storage_method || null
    if (is_published !== undefined) updateData.is_published = !!is_published
    if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url || null

    if (Object.keys(updateData).length > 0) {
      const { error: pe } = await supabaseAdmin.from('products').update(updateData).eq('id', productId)
      if (pe) return NextResponse.json({ success: false, error: pe.message }, { status: 500 })
    }

    // Update categories
    if (category_ids !== undefined) {
      await supabaseAdmin.from('product_category_relations').delete().eq('product_id', productId)
      if (category_ids.length > 0) {
        await supabaseAdmin.from('product_category_relations')
          .insert(category_ids.map((cid: number) => ({ product_id: productId, category_id: cid })))
      }
    }

    // 商品分類（逛街用）。沒帶這個欄位就不動 —— 批次指派畫面只送分類，
    // 不該因此把商品其他欄位或原本的分類清掉。
    if (shop_category_ids !== undefined) {
      await saveShopCategories(productId, normalizeCategoryIds(shop_category_ids))
    }

    // Update variants
    if (variants !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from('product_variants').select('id').eq('product_id', productId)
      const existingIds = (existing || []).map((v: any) => v.id)
      const keepIds = variants.filter((v: any) => v.id).map((v: any) => v.id)
      const toDelete = existingIds.filter((id: number) => !keepIds.includes(id))
      if (toDelete.length > 0) {
        await supabaseAdmin.from('product_variants').delete().in('id', toDelete)
      }
      for (const [i, v] of variants.entries()) {
        const vData = {
          product_id: productId,
          variant_name: v.variant_name,
          sale_price: parseFloat(v.sale_price) || 0,
          original_price: v.original_price ? parseFloat(v.original_price) : null,
          stock_qty: parseInt(v.stock_qty) || 0,
          sku_code: v.sku_code || null,
          sort_order: i,
          is_active: v.is_active !== false,
        }
        if (v.id) {
          await supabaseAdmin.from('product_variants').update(vData).eq('id', v.id)
        } else {
          await supabaseAdmin.from('product_variants').insert(vData)
        }
      }
    }

    // Update gallery images
    if (gallery_images !== undefined) {
      await supabaseAdmin.from('product_images').delete().eq('product_id', productId)
      if (gallery_images.length > 0) {
        await supabaseAdmin.from('product_images').insert(
          gallery_images.map((img: any, i: number) => ({
            product_id: productId,
            image_url: typeof img === 'string' ? img : img.image_url,
            sort_order: i,
          }))
        )
      }
    }

    refreshStorefront()
    return NextResponse.json({ success: true, message: '商品更新成功' })
  } catch (err) {
    console.error('Update product error:', err)
    return NextResponse.json({ success: false, error: '更新商品失敗' }, { status: 500 })
  }
}

/** products_archive.sql 執行過了沒（products 有沒有 archived_at 欄位） */
async function archiveReady() {
  const { error } = await supabaseAdmin.from('products').select('archived_at').limit(0)
  return !error
}

/**
 * 刪除商品。
 *
 * 已經有人訂過的商品不能真的刪：訂單明細連著它（order_items_product_id_fkey），
 * 刪掉的話舊訂單、報表都會失去對應，資料庫也會拒絕。這種商品改成「封存」：
 * 下架、從後台商品列表與前台移除，資料留著，之後可以在「已封存」裡還原。
 * 沒有任何訂單的商品才真的刪除。
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ success: false, error: '商品編號錯誤' }, { status: 400 })

  const { count, error: countErr } = await supabaseAdmin.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
  if (countErr) return NextResponse.json({ success: false, error: '無法確認商品的訂單紀錄，請稍後再試' }, { status: 500 })

  if (!count) {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
    if (!error) {
      refreshStorefront()
      return NextResponse.json({ success: true, archived: false, message: '商品已刪除' })
    }
    // 其他資料（例如賣貨便轉單）還連著它：一樣改成封存，不要把英文錯誤丟給使用者
    if (error.code !== '23503') return NextResponse.json({ success: false, error: '刪除失敗，請稍後再試' }, { status: 500 })
  }

  const ready = await archiveReady()
  const patch: Record<string, unknown> = { is_published: false }
  if (ready) patch.archived_at = new Date().toISOString()
  const { error } = await supabaseAdmin.from('products').update(patch).eq('id', id)
  if (error) return NextResponse.json({ success: false, error: '封存失敗，請稍後再試' }, { status: 500 })
  refreshStorefront()
  const why = count ? `這個商品有 ${count} 筆訂單紀錄` : '這個商品還有其他資料連著'
  return NextResponse.json({
    success: true, archived: ready, orderCount: count || 0,
    message: ready
      ? `${why}，不能刪除，已改為封存（前台與商品列表不再顯示，訂單資料保留，可在「已封存」還原）`
      : `${why}，不能刪除，已改為下架。執行 migrations/products_archive.sql 後，就能封存並從列表隱藏`,
  })
}

/** 還原封存的商品：回到商品列表，維持下架，確認後再自行上架 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  if (body?.action !== 'restore') return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
  const { error } = await supabaseAdmin.from('products').update({ archived_at: null }).eq('id', params.id)
  if (error) return NextResponse.json({ success: false, error: '還原失敗' }, { status: 500 })
  return NextResponse.json({ success: true, message: '已還原到商品列表（目前是下架狀態）' })
}
