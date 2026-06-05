import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'

export interface AuthedUser {
  id: string
  email: string
}

/**
 * Extract & verify the user from the Authorization: Bearer <access_token> header.
 * Returns null if no valid token.
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthedUser | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  if (!token) return null

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email || '' }
  } catch {
    return null
  }
}

/**
 * Middleware for API routes that require auth.
 * Usage:
 *   const auth = await requireUser(req)
 *   if (auth instanceof NextResponse) return auth
 *   const { user } = auth
 */
export async function requireUser(
  req: NextRequest
): Promise<{ user: AuthedUser } | NextResponse> {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
  }
  return { user }
}
