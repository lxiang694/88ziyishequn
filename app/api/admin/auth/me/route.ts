import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'

// GET /api/admin/auth/me - get current admin info
export async function GET(req: NextRequest) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ success: false, error: '未登入' }, { status: 401 })
  }
  return NextResponse.json({ success: true, data: admin })
}

// DELETE /api/admin/auth/me - logout
export async function DELETE() {
  const res = NextResponse.json({ success: true, message: '已登出' })
  res.cookies.set('admin_token', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
  return res
}
