import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'admin_token'

/**
 * 後台登入用的簽章金鑰。
 *
 * 以前沒設定 JWT_SECRET 時會退回一個寫在程式碼裡的預設字串 —— 程式碼是公開的，
 * 任何人都能用那個字串自己簽一張「超級管理員」登入憑證。現在正式環境沒設定
 * （或太短）就直接拒絕登入，寧可登不進去也不要被偽造。開發／測試環境才用預設值。
 */
function jwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (s && s.length >= 16) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET 未設定或少於 16 個字元，請到 Vercel 的 Environment Variables 設定')
  }
  return 'dev-only-secret-not-for-production'
}

export interface AdminTokenPayload {
  id: number
  name: string
  account: string
  role_key: string
  permissions: string[]
}

export function signToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, jwtSecret(), { algorithm: 'HS256', expiresIn: '8h' })
}

export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as AdminTokenPayload
  } catch {
    return null
  }
}

export function getAdminFromRequest(req: NextRequest): AdminTokenPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
