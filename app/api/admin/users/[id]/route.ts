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
  // 超級管理員幫人改密碼時一併解除登入鎖定（admin_login_lockout.sql 還沒執行時這兩欄不存在，不帶）
  const { data: lockCols } = await supabaseAdmin.from('admin_users').select('*').eq('id', params.id).maybeSingle()
  if (password && lockCols && 'locked_until' in lockCols) { updateData.failed_login_count = 0; updateData.locked_until = null }
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
