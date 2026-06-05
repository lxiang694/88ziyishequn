import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'categories.all')
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { name, slug, sort_order, is_active } = body

  const { data, error } = await supabaseAdmin
    .from('health_categories')
    .update({ name, slug, sort_order, is_active })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'categories.all')
  if (auth instanceof NextResponse) return auth

  const { error } = await supabaseAdmin
    .from('health_categories')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, message: '分類已刪除' })
}
