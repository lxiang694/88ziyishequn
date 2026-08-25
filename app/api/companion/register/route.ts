import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signCompanionToken, COMPANION_COOKIE } from '@/lib/companionAuth'
import { validateTWPhone } from '@/lib/utils'

export const runtime = 'nodejs'

/**
 * 陪診員自助註冊（手機號碼即可）
 * 註冊後狀態為 pending，需完成資料填寫並經後台審核才能接單。
 */
export async function POST(req: NextRequest) {
  try {
    const { name, phone, password, consent } = await req.json()

    if (!name || !phone || !password) {
      return NextResponse.json({ success: false, error: '請填寫姓名、手機與密碼' }, { status: 400 })
    }
    if (!validateTWPhone(String(phone).trim())) {
      return NextResponse.json({ success: false, error: '請填寫正確的手機號碼（09xxxxxxxx）' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return NextResponse.json({ success: false, error: '密碼至少 6 碼' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ success: false, error: '請先閱讀並同意個人資料蒐集聲明' }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(String(password), 10)
    const { data, error } = await supabaseAdmin
      .from('companions')
      .insert({
        name: String(name).trim(),
        phone: String(phone).trim(),
        password_hash,
        status: 'pending',
        consent_at: new Date().toISOString(),
      })
      .select('id, name, phone')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '此手機號碼已註冊，請直接登入' }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // 註冊後直接發 token，讓對方可以接著填資料、上傳證件（但仍不能接單）
    const token = signCompanionToken({ id: data.id, name: data.name, phone: data.phone })
    const res = NextResponse.json({ success: true, data })
    res.cookies.set(COMPANION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ success: false, error: '註冊失敗，請稍後再試' }, { status: 500 })
  }
}
