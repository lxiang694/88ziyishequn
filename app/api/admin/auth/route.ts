import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { account, password } = await req.json()
    if (!account || !password) {
      return NextResponse.json({ success: false, error: '請輸入帳號與密碼' }, { status: 400 })
    }

    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('*, admin_roles(role_name, role_key, permissions_json)')
      .eq('account', account)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ success: false, error: '帳號或密碼錯誤' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ success: false, error: '帳號或密碼錯誤' }, { status: 401 })
    }

    // 帳號自訂權限優先；未設定則沿用角色預設權限
    const rolePerms: string[] = user.admin_roles?.permissions_json || []
    const accountPerms = user.permissions_json
    const permissions: string[] = Array.isArray(accountPerms) && accountPerms.length > 0 ? accountPerms : rolePerms
    const role_key = user.admin_roles?.role_key || ''
    const role_name = user.admin_roles?.role_name || ''

    const token = signToken({
      id: user.id,
      name: user.name,
      account: user.account,
      role_key,
      permissions,
    })

    const res = NextResponse.json({
      success: true,
      data: { id: user.id, name: user.name, account: user.account, role_key, role_name, permissions },
    })

    res.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return res
  } catch (err) {
    console.error('[admin login]', err instanceof Error ? err.message : err)
    // 金鑰沒設定時直接講清楚該怎麼修（說出「沒設定」不會讓人能偽造登入：沒有金鑰就不發憑證）
    if (err instanceof Error && err.message.startsWith('JWT_SECRET')) {
      return NextResponse.json({ success: false, error: '網站尚未設定 JWT_SECRET：請到 Vercel → Settings → Environment Variables 新增（至少 16 個字元的隨機字串）後重新部署' }, { status: 500 })
    }
    return NextResponse.json({ success: false, error: '登入失敗，請稍後再試' }, { status: 500 })
  }
}
