import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { refreshStorefront } from '@/lib/storefrontCache'
import { isOwnStorageUrl } from '@/lib/productImageUrl'

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const PAGE = 500

type Usage = { product_id: number; product_name: string; kind: 'cover' | 'gallery' }

/** 列出商品用到的所有圖片（封面＋相簿），同一張圖被多個商品用到時合併成一筆 */
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'products.all')
  if (auth instanceof NextResponse) return auth

  const byUrl = new Map<string, Usage[]>()
  const add = (url: string | null, u: Usage) => {
    if (!isOwnStorageUrl(url, SUPABASE_URL)) return
    byUrl.set(url, [...(byUrl.get(url) || []), u])
  }
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from('products')
      .select('id, product_name, cover_image_url, product_images(image_url)')
      .order('id').range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ success: false, error: '讀取商品失敗' }, { status: 500 })
    for (const p of (data || []) as any[]) {
      add(p.cover_image_url, { product_id: p.id, product_name: p.product_name, kind: 'cover' })
      for (const img of p.product_images || []) add(img.image_url, { product_id: p.id, product_name: p.product_name, kind: 'gallery' })
    }
    if (!data || data.length < PAGE) break
  }
  const images = [...byUrl.entries()].map(([url, usages]) => ({ url, usages }))
  return NextResponse.json({ success: true, data: images })
}

/** 把商品上的某張圖換成壓縮後的版本。原檔留在儲存空間裡，不刪除，可以隨時換回來 */
export async function POST(req: NextRequest) {
  const auth = requirePermission(req, 'products.all')
  if (auth instanceof NextResponse) return auth
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  const { from, to } = body || {}
  if (!isOwnStorageUrl(from, SUPABASE_URL) || !isOwnStorageUrl(to, SUPABASE_URL) || from === to) {
    return NextResponse.json({ success: false, error: '圖片網址不正確' }, { status: 400 })
  }

  const [cover, gallery] = await Promise.all([
    supabaseAdmin.from('products').update({ cover_image_url: to }).eq('cover_image_url', from).select('id'),
    supabaseAdmin.from('product_images').update({ image_url: to }).eq('image_url', from).select('id'),
  ])
  if (cover.error || gallery.error) {
    return NextResponse.json({ success: false, error: '更新商品圖片失敗' }, { status: 500 })
  }
  const updated = (cover.data?.length || 0) + (gallery.data?.length || 0)
  await writeAuditLog(req, auth.admin, 'product_images.compress', `${from} → ${to}（${updated} 處）`)
  refreshStorefront()
  return NextResponse.json({ success: true, updated })
}
