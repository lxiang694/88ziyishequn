import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signCompanionToken, COMPANION_COOKIE } from '@/lib/companionAuth'

export const runtime = 'nodejs'

/** 陪診員登入（帳號＝手機號碼） */
export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json()
    if (!phone || !password) {
      return NextResponse.json({ success: false, error: '請輸入手機號碼與密碼' }, { status: 400 })
    }

    const { data: c, error } = await supabaseAdmin
      .from('companions')
      .select('*')
      .eq('phone', String(phone).trim())
      .single()

    if (error || !c) {
      return NextResponse.json({ success: false, error: '手機號碼或密碼錯誤' }, { status: 401 })
    }
    const valid = await bcrypt.compare(password, c.password_hash)
    if (!valid) {
      return NextResponse.json({ success: false, error: '手機號碼或密碼錯誤' }, { status: 401 })
    }
    if (c.status === 'pending') {
      return NextResponse.json({ success: false, error: '您的帳號尚在審核中，請聯絡客服' }, { status: 403 })
    }
    if (c.status !== 'active') {
      return NextResponse.json({ success: false, error: '此帳號已停用，請聯絡客服' }, { status: 403 })
    }

    const token = signCompanionToken({ id: c.id, name: c.name, phone: c.phone })
    const res = NextResponse.json({
      success: true,
      data: { id: c.id, name: c.name, phone: c.phone, employment_type: c.employment_type },
    })
    res.cookies.set(COMPANION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ success: false, error: '登入失敗，請稍後再試' }, { status: 500 })
  }
}
