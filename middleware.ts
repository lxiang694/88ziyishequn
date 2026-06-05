import { NextRequest, NextResponse } from 'next/server'

// Edge Runtime 不支援 jsonwebtoken，改用原生 atob 解碼 JWT payload
function decodeJWT(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('admin_token')?.value
    if (!token) return NextResponse.redirect(new URL('/admin/login', req.url))
    const payload = decodeJWT(token)
    if (!payload) {
      const res = NextResponse.redirect(new URL('/admin/login', req.url))
      res.cookies.set('admin_token', '', { maxAge: 0, path: '/' })
      return res
    }
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
