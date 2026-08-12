import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { HOME_SECTION_KEYS } from '@/lib/homeSections'

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
  return NextResponse.json({ success: true, data })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { product_name, short_intro, suitable_people, usage_method, ingredients,
            precautions, storage_method, is_published, cover_image_url, home_section,
            intake_timing, pairing_tips, source_notes,
            category_ids, variants, gallery_images } = body
    const productId = parseInt(params.id)

    // Build update object - only include defined fields
    const updateData: any = {}
    if (product_name !== undefined) updateData.product_name = product_name
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

    return NextResponse.json({ success: true, message: '商品更新成功' })
  } catch (err) {
    console.error('Update product error:', err)
    return NextResponse.json({ success: false, error: '更新商品失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireProductPerm(req)
  if (auth instanceof NextResponse) return auth
  const { error } = await supabaseAdmin.from('products').delete().eq('id', params.id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, message: '商品已刪除' })
}
