import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromRequest } from '@/lib/userAuth'

export const runtime = 'nodejs'

const VISITOR_COOKIE = 'visitor_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 年

// 只接受白名單事件，避免被灌入任意資料
const ALLOWED = new Set(['add_to_cart', 'submit_click', 'submit_fail', 'order_success'])

/**
 * 下單漏斗事件上報。前台在關鍵節點 POST { event, meta?, path? }。
 * 公開端點（不需登入）；共用 page_views 的 visitor_id cookie，若帶會員 token 也記錄 user_id。
 * 任何錯誤都不影響前台體驗。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const event: string = (body?.event || '').toString()
    if (!ALLOWED.has(event)) return NextResponse.json({ success: true })

    const path: string = (body?.path || '').toString().slice(0, 500) || null
    let meta = body?.meta ?? null
    if (meta && typeof meta === 'object') {
      // 限制大小，避免異常巨大的 payload
      try { if (JSON.stringify(meta).length > 2000) meta = null } catch { meta = null }
    } else {
      meta = null
    }

    // 取得 / 產生訪客識別（與 /api/track 共用同一個 cookie）
    let visitorId = req.cookies.get(VISITOR_COOKIE)?.value
    const isNewVisitor = !visitorId
    if (!visitorId) visitorId = randomUUID()

    const authedUser = await getUserFromRequest(req).catch(() => null)

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('funnel_events').insert({
        event,
        visitor_id: visitorId,
        user_id: authedUser?.id || null,
        path,
        meta,
      })
      if (error && error.code !== '42P01') console.error('[track/event] insert failed:', error.code, error.message)
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
    return NextResponse.json({ success: true })
  }
}
