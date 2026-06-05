import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin.from('health_categories').select('*').order('sort_order')
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('categories.all') && !admin.permissions.includes('products.all')) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }
  const body = await req.json()
  const { name, slug, sort_order, is_active } = body
  if (!name || !slug) return NextResponse.json({ success: false, error: '名稱與識別碼為必填' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('health_categories').insert({ name, slug, sort_order: sort_order || 0, is_active: is_active !== false }).select().single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
