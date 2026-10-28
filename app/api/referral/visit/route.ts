import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCode } from '@/lib/referral'

/** 有人點了推薦連結。同一位訪客、同一個推薦碼，24 小時內只記一次 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = normalizeCode(body?.code)
    if (!code) return NextResponse.json({ success: true })
    const visitor = req.cookies.get('visitor_id')?.value?.slice(0, 64) || null
    const { data: exists } = await supabaseAdmin.from('referral_codes').select('code').eq('code', code).maybeSingle()
    if (!exists) return NextResponse.json({ success: true })
    if (visitor) {
      const since = new Date(Date.now() - 86_400_000).toISOString()
      const { count } = await supabaseAdmin.from('referral_visits').select('id', { count: 'exact', head: true })
        .eq('code', code).eq('visitor_id', visitor).gte('created_at', since)
      if (count) return NextResponse.json({ success: true })
    }
    const landing = typeof body?.landing === 'string' ? body.landing.slice(0, 300) : null
    await supabaseAdmin.from('referral_visits').insert({ code, visitor_id: visitor, landing })
  } catch {
    // 推薦統計不能影響瀏覽
  }
  return NextResponse.json({ success: true })
}
