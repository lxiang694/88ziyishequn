import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion } from '@/lib/companionAuth'
import { toTWDate } from '@/lib/adminDateRange'

export const runtime = 'nodejs'

/** 陪診員查看自己的收入（僅自己的資料） */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('care_bookings')
    .select('*')
    .eq('companion_id', auth.companion.id)
    .eq('status', '已完成')
    .order('service_date', { ascending: false })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ success: true, data: { total: 0, settled: 0, unsettled: 0, jobs: 0, by_month: [], list: [] } })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const rows = data || []
  // 實拿 = 方案報酬 + 加購報酬 + 額外報酬（結算時加給的超時、加班等）
  const feeOf = (r: any) =>
    (r.companion_fee || 0) + (r.addon_companion_fee || 0) + (r.extra_companion_fee || 0)
  const total = rows.reduce((s: number, r: any) => s + feeOf(r), 0)
  const settled = rows.filter((r: any) => r.settled_at).reduce((s: number, r: any) => s + feeOf(r), 0)

  // 依月份彙總
  const monthMap = new Map<string, { month: string; jobs: number; fee: number; unsettled: number }>()
  for (const r of rows as any[]) {
    const m = (r.service_date || '').slice(0, 7)
    if (!m) continue
    if (!monthMap.has(m)) monthMap.set(m, { month: m, jobs: 0, fee: 0, unsettled: 0 })
    const item = monthMap.get(m)!
    item.jobs++
    item.fee += feeOf(r)
    if (!r.settled_at) item.unsettled += feeOf(r)
  }

  return NextResponse.json({
    success: true,
    data: {
      jobs: rows.length,
      total,
      settled,
      unsettled: total - settled,
      by_month: [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month)),
      list: rows.map((r: any) => ({
        id: r.id, booking_no: r.booking_no, service_name: r.service_name,
        service_date: r.service_date, hospital: r.hospital,
        fee: feeOf(r), settled: !!r.settled_at,
        settled_at: r.settled_at || null,
        // 拆帳明細：陪診員要看得懂這筆錢是怎麼算出來的
        base_fee: r.companion_fee || 0,
        addon_fee: r.addon_companion_fee || 0,
        extra_fee: r.extra_companion_fee || 0,
        note: r.settlement_note || '',
      })),
    },
  })
}
