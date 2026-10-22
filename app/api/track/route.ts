import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromRequest } from '@/lib/userAuth'

export const runtime = 'nodejs'

const VISITOR_COOKIE = 'visitor_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 年

/** 前台帶來的 utm 標記；沒有就回 null */
function utmFields(body: any) {
  const out: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const v = typeof body?.[key] === 'string' ? body[key].trim().slice(0, 100) : ''
    if (v) out[key] = v
  }
  return Object.keys(out).length ? out : null
}

/**
 * 前台流量上報。前台每次頁面瀏覽會 POST 一筆 { path, referrer }。
 * 公開端點（不需登入）；若帶有會員 token 則一併記錄 user_id。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    let path: string = (body?.path || '').toString().slice(0, 500)
    const referrer: string = (body?.referrer || '').toString().slice(0, 500)

    // 沒有路徑或為後台頁面則不記錄
    if (!path || path.startsWith('/admin') || path.startsWith('/api')) {
      return NextResponse.json({ success: true })
    }

    // 取得 / 產生訪客識別
    let visitorId = req.cookies.get(VISITOR_COOKIE)?.value
    const isNewVisitor = !visitorId
    if (!visitorId) visitorId = randomUUID()

    // 若帶有會員 token，記錄會員 id（可為 null）
    const authedUser = await getUserFromRequest(req).catch(() => null)

    const userAgent = req.headers.get('user-agent')?.slice(0, 300) || null

    // 寫入（容錯：表不存在或失敗都不影響前台）
    if (supabaseAdmin) {
      const row = {
        path,
        referrer: referrer || null,
        visitor_id: visitorId,
        user_id: authedUser?.id || null,
        user_agent: userAgent,
      }
      const utm = utmFields(body)
      let { error } = await supabaseAdmin.from('page_views').insert(utm ? { ...row, ...utm } : row)
      // traffic_sources.sql 還沒執行（沒有 utm 欄位）：先記下瀏覽，utm 不存
      if (error && utm && (error.code === 'PGRST204' || error.code === '42703')) {
        ({ error } = await supabaseAdmin.from('page_views').insert(row))
      }
      if (error) console.error('[track] insert failed:', error.code, error.message)
    }

    const res = NextResponse.json({ success: true })
    if (isNewVisitor) {
      res.cookies.set(VISITOR_COOKIE, visitorId, {
        maxAge: COOKIE_MAX_AGE,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
    return res
  } catch {
    // 流量統計不應影響使用者體驗
    return NextResponse.json({ success: true })
  }
}
