import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { name, account, password, role_id, is_active, permissions } = await req.json()
  const updateData: any = { name, account, role_id, is_active }
  if (password) updateData.password_hash = await bcrypt.hash(password, 10)
  if (Array.isArray(permissions)) updateData.permissions_json = permissions
  const { data, error } = await supabaseAdmin
    .from('admin_users').update(updateData).eq('id', params.id)
    .select('id, name, account, role_id, is_active, permissions_json').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (auth.admin.id === parseInt(params.id)) {
    return NextResponse.json({ success: false, error: '不可刪除自己的帳號' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('admin_users').delete().eq('id', params.id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, message: '帳號已刪除' })
}
