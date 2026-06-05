import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest, AdminTokenPayload } from '@/lib/auth'

type AuthResult = { admin: AdminTokenPayload }

export function requireAdmin(req: NextRequest): AuthResult | NextResponse {
  const admin = getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ success: false, error: '請先登入後台' }, { status: 401 })
  return { admin }
}

export function requireSuperAdmin(req: NextRequest): AuthResult | NextResponse {
  const result = requireAdmin(req)
  if (result instanceof NextResponse) return result
  const { admin } = result
  if (!admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '此功能僅限超級管理員' }, { status: 403 })
  }
  return { admin }
}

export function requirePermission(req: NextRequest, permission: string): AuthResult | NextResponse {
  const result = requireAdmin(req)
  if (result instanceof NextResponse) return result
  const { admin } = result
  if (!admin.permissions.includes('all') && !admin.permissions.includes(permission)) {
    return NextResponse.json({ success: false, error: '您沒有此操作的權限' }, { status: 403 })
  }
  return { admin }
}
