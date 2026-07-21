import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'

export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, name, account, role_id, is_active, permissions_json, created_at, admin_roles(role_name, role_key)')
    .order('created_at')
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function POST(req: NextRequest) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { name, account, password, role_id, is_active, permissions } = await req.json()
  if (!name || !account || !password || !role_id) {
    return NextResponse.json({ success: false, error: '所有欄位為必填' }, { status: 400 })
  }
  const password_hash = await bcrypt.hash(password, 10)
  const insertData: any = { name, account, password_hash, role_id, is_active: is_active !== false }
  if (Array.isArray(permissions)) insertData.permissions_json = permissions
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert(insertData)
    .select('id, name, account, role_id, is_active, permissions_json, created_at')
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ success: false, error: '此帳號已存在' }, { status: 400 })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}
