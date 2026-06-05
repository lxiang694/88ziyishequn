import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { generateSlug } from '@/lib/utils'

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

  let query = supabaseAdmin
    .from('products')
    .select(`*, product_variants(id,variant_name,sale_price,original_price,stock_qty,sku_code,sort_order,is_active), product_images(id,image_url,sort_order), product_category_relations(health_categories(id,name,slug))`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) query = query.ilike('product_name', `%${search}%`)
  if (published === 'true') query = query.eq('is_published', true)
  if (published === 'false') query = query.eq('is_published', false)
  if (productIdFilter !== null) query = query.in('id', productIdFilter)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [], total: count || 0, page, limit })
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
    const { product_name, short_intro, suitable_people, usage_method, ingredients, precautions, storage_method, is_published, cover_image_url, category_ids, variants, gallery_images } = body
    if (!product_name) return NextResponse.json({ success: false, error: '商品名稱為必填' }, { status: 400 })
    const slug = generateSlug(product_name)
    const { data: product, error: pe } = await supabaseAdmin
      .from('products')
      .insert({ product_name, slug, short_intro: short_intro || null, suitable_people: suitable_people || null, usage_method: usage_method || null, ingredients: ingredients || null, precautions: precautions || null, storage_method: storage_method || null, is_published: !!is_published, cover_image_url: cover_image_url || null })
      .select().single()
    if (pe) return NextResponse.json({ success: false, error: pe.message }, { status: 500 })
    if (category_ids?.length > 0) {
      await supabaseAdmin.from('product_category_relations').insert(category_ids.map((cid: number) => ({ product_id: product.id, category_id: cid })))
    }
    if (variants?.length > 0) {
      await supabaseAdmin.from('product_variants').insert(variants.map((v: any, i: number) => ({
        product_id: product.id, variant_name: v.variant_name, sale_price: parseFloat(v.sale_price),
        original_price: v.original_price ? parseFloat(v.original_price) : null,
        stock_qty: parseInt(v.stock_qty) || 0, sku_code: v.sku_code || null, sort_order: i, is_active: v.is_active !== false,
      })))
    }
    if (gallery_images?.length > 0) {
      await supabaseAdmin.from('product_images').insert(gallery_images.map((img: any, i: number) => ({
        product_id: product.id, image_url: typeof img === 'string' ? img : img.image_url, sort_order: i,
      })))
    }
    return NextResponse.json({ success: true, data: product })
  } catch {
    return NextResponse.json({ success: false, error: '新增商品失敗' }, { status: 500 })
  }
}
