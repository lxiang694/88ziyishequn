import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion } from '@/lib/companionAuth'

export const runtime = 'nodejs'

/** 取得自己未來的可服務時段 */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('companion_availability')
    .select('id, date, time_slot')
    .eq('companion_id', auth.companion.id)
    .gte('date', today)
    .order('date', { ascending: true })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [] })
}

/** 新增／取消某一天的某個時段（自行安排時間） */
export async function POST(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { date, time_slot, enabled } = await req.json()
    if (!date || !time_slot) {
      return NextResponse.json({ success: false, error: '缺少日期或時段' }, { status: 400 })
    }

    if (enabled) {
      const { error } = await supabaseAdmin
        .from('companion_availability')
        .upsert(
          { companion_id: auth.companion.id, date, time_slot },
          { onConflict: 'companion_id,date,time_slot' },
        )
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    } else {
      const { error } = await supabaseAdmin
        .from('companion_availability')
        .delete()
        .eq('companion_id', auth.companion.id)
        .eq('date', date)
        .eq('time_slot', time_slot)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '設定失敗' }, { status: 500 })
  }
}
