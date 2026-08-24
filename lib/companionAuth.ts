import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'
export const COMPANION_COOKIE = 'companion_token'

export interface CompanionTokenPayload {
  id: number
  name: string
  phone: string
}

export function signCompanionToken(payload: CompanionTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' })
}

export function verifyCompanionToken(token: string): CompanionTokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as CompanionTokenPayload
  } catch {
    return null
  }
}

export function getCompanionFromRequest(req: NextRequest): CompanionTokenPayload | null {
  const token = req.cookies.get(COMPANION_COOKIE)?.value
  if (!token) return null
  return verifyCompanionToken(token)
}

/** 陪診員端 API 守門：未登入回 401 */
export function requireCompanion(req: NextRequest): { companion: CompanionTokenPayload } | NextResponse {
  const companion = getCompanionFromRequest(req)
  if (!companion) return NextResponse.json({ success: false, error: '請先登入陪診員系統' }, { status: 401 })
  return { companion }
}
