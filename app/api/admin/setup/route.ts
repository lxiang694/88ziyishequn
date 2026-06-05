import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/admin/setup?key=healthec-setup-2024
// 部署後執行一次以初始化帳號密碼
export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key')
  const setupKey = process.env.SETUP_KEY || 'healthec-setup-2024'

  if (key !== setupKey) {
    return NextResponse.json({
      error: '請提供 setup key',
      usage: `${new URL(req.url).origin}/api/admin/setup?key=${setupKey}`,
    }, { status: 401 })
  }

  const hash = await bcrypt.hash('Admin@1234', 10)

  // Get all roles first
  const { data: roles } = await supabaseAdmin.from('admin_roles').select('id, role_key')
  const roleMap = Object.fromEntries((roles || []).map((r: any) => [r.role_key, r.id]))

  const accounts = [
    { name: '系統管理員', account: 'admin', role_key: 'super_admin' },
    { name: '客服小張', account: 'cs01', role_key: 'customer_service' },
    { name: '出貨員小李', account: 'ship01', role_key: 'shipper' },
    { name: '商品管理小王', account: 'pm01', role_key: 'product_manager' },
  ]

  const results: string[] = []

  for (const acc of accounts) {
    const role_id = roleMap[acc.role_key]
    if (!role_id) { results.push(`⚠️ ${acc.account}: 找不到角色 ${acc.role_key}`); continue }

    // Try update first (if account exists with PENDING_SETUP)
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('admin_users')
      .update({ password_hash: hash, name: acc.name, is_active: true })
      .eq('account', acc.account)
      .select('id')

    if (updated && updated.length > 0) {
      results.push(`✅ ${acc.account}: 密碼已更新`)
      continue
    }

    // Insert if not exists
    const { error: insertErr } = await supabaseAdmin
      .from('admin_users')
      .insert({ name: acc.name, account: acc.account, password_hash: hash, role_id, is_active: true })

    if (insertErr) {
      results.push(`❌ ${acc.account}: ${insertErr.message}`)
    } else {
      results.push(`✅ ${acc.account}: 帳號已建立`)
    }
  }

  return NextResponse.json({
    success: true,
    message: '初始化完成！',
    results,
    login_info: { url: '/admin/login', default_password: 'Admin@1234' },
    warning: '⚠️ 請立即登入後台並修改所有帳號密碼！',
  })
}
