import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { getTWDateRange, toTWDate } from '@/lib/adminDateRange'

export const runtime = 'nodejs'

/**
 * 陪診服務報表 + 收入結算
 * 財務資料僅限超級管理員
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '此功能僅限超級管理員' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dateRange = searchParams.get('dateRange') || '30days'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const isAll = dateRange === 'all'
  const { start, end } = getTWDateRange(isAll ? '30days' : dateRange, startDate, endDate)

  // 以「服務日期」為基準統計（比建立時間更貼近實際營運）
  const startDay = isAll ? '' : toTWDate(start)
  const endDay = isAll ? '' : toTWDate(end)

  let q = supabaseAdmin
    .from('care_bookings')
    .select('*, companions(id, name, phone)')
    .order('service_date', { ascending: false })
  if (!isAll) q = q.gte('service_date', startDay).lte('service_date', endDay)

  const { data: rows, error } = await q

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ success: true, data: emptyPayload(), table_missing: true })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // 待結算清單「不受期間篩選」——這是待辦清單，不是報表。
  // 服務日期若排在未來或更早之前，仍必須看得到，否則會漏付陪診員報酬。
  const { data: doneRows, error: doneErr } = await supabaseAdmin
    .from('care_bookings')
    .select('*, companions(id, name, phone)')
    .eq('status', '已完成')
    .order('service_date', { ascending: false })
  if (doneErr && doneErr.code !== '42P01') {
    return NextResponse.json({ success: false, error: doneErr.message }, { status: 500 })
  }

  const all = rows || []
  const done = all.filter((r: any) => r.status === '已完成')
  const cancelled = all.filter((r: any) => r.status === '已取消')

  const revenue = done.reduce((s: number, r: any) => s + (r.price || 0) + (r.addon_fee || 0) + (r.extra_fee || 0), 0)
  const cost = done.reduce((s: number, r: any) => s + (r.companion_fee || 0) + (r.addon_companion_fee || 0), 0)
  const profit = revenue - cost

  // 方案分佈
  const byPlanMap = new Map<string, { name: string; count: number; revenue: number }>()
  for (const r of done) {
    const k = r.service_code || 'unknown'
    if (!byPlanMap.has(k)) byPlanMap.set(k, { name: r.service_name || k, count: 0, revenue: 0 })
    const p = byPlanMap.get(k)!
    p.count++
    p.revenue += (r.price || 0) + (r.addon_fee || 0) + (r.extra_fee || 0)
  }

  // 縣市分佈
  const byCountyMap = new Map<string, number>()
  for (const r of done) {
    const k = r.county || '未填'
    byCountyMap.set(k, (byCountyMap.get(k) || 0) + 1)
  }

  // 陪診員績效與應付報酬
  const byCompanionMap = new Map<number, {
    id: number; name: string; phone: string
    jobs: number; revenue: number; fee: number
    unsettled_jobs: number; unsettled_fee: number
  }>()
  for (const r of done) {
    if (!r.companion_id) continue
    const c: any = r.companions
    if (!byCompanionMap.has(r.companion_id)) {
      byCompanionMap.set(r.companion_id, {
        id: r.companion_id, name: c?.name || `#${r.companion_id}`, phone: c?.phone || '',
        jobs: 0, revenue: 0, fee: 0, unsettled_jobs: 0, unsettled_fee: 0,
      })
    }
    const item = byCompanionMap.get(r.companion_id)!
    item.jobs++
    item.revenue += (r.price || 0) + (r.addon_fee || 0) + (r.extra_fee || 0)
    item.fee += (r.companion_fee || 0) + (r.addon_companion_fee || 0)
    if (!r.settled_at) {
      item.unsettled_jobs++
      item.unsettled_fee += (r.companion_fee || 0) + (r.addon_companion_fee || 0)
    }
  }

  // 未結算明細（供逐筆核對與批次結算）——來源為「全部已完成」，不套用期間
  const unsettled = (doneRows || [])
    .filter((r: any) => !r.settled_at && r.companion_id)
    .map((r: any) => ({
      id: r.id, booking_no: r.booking_no, service_date: r.service_date,
      service_name: r.service_name, patient_name: r.patient_name,
      hospital: r.hospital, county: r.county,
      price: r.price, extra_fee: r.extra_fee || 0, addon_fee: r.addon_fee || 0,
      companion_fee: r.companion_fee || 0, addon_companion_fee: r.addon_companion_fee || 0,
      companion_id: r.companion_id,
      companion_name: (r.companions as any)?.name || '',
    }))

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        total_bookings: all.length,
        completed: done.length,
        cancelled: cancelled.length,
        in_progress: all.filter((r: any) => ['已派工', '服務中'].includes(r.status)).length,
        pending: all.filter((r: any) => ['待確認', '待匯款', '已付款'].includes(r.status)).length,
        revenue, cost, profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
        avg_order: done.length > 0 ? Math.round(revenue / done.length) : 0,
        unsettled_total: unsettled.reduce((s, r) => s + r.companion_fee + r.addon_companion_fee, 0),
      },
      by_plan: [...byPlanMap.values()].sort((a, b) => b.count - a.count),
      by_county: [...byCountyMap.entries()].map(([county, count]) => ({ county, count })).sort((a, b) => b.count - a.count),
      by_companion: [...byCompanionMap.values()].sort((a, b) => b.jobs - a.jobs),
      unsettled,
      range: { start: startDay || '不限', end: endDay || '不限' },
    },
  })
}

function emptyPayload() {
  return {
    summary: {
      total_bookings: 0, completed: 0, cancelled: 0, in_progress: 0, pending: 0,
      revenue: 0, cost: 0, profit: 0, margin: 0, avg_order: 0, unsettled_total: 0,
    },
    by_plan: [], by_county: [], by_companion: [], unsettled: [], range: { start: '', end: '' },
  }
}

/** 標記結算 / 調整單筆報酬與額外收費 */
export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '此功能僅限超級管理員' }, { status: 403 })
  }

  try {
    const { action, ids, id, companion_fee, extra_fee, settlement_note } = await req.json()

    // 批次標記已結算 / 取消結算
    if (action === 'settle' || action === 'unsettle') {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ success: false, error: '請選擇要結算的項目' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('care_bookings')
        .update({
          settled_at: action === 'settle' ? new Date().toISOString() : null,
          settlement_note: settlement_note ?? null,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids)
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, count: ids.length })
    }

    // 調整單筆
    if (!id) return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 })
    const update: any = { updated_at: new Date().toISOString() }
    if (companion_fee !== undefined) update.companion_fee = Number(companion_fee) || 0
    if (extra_fee !== undefined) update.extra_fee = Number(extra_fee) || 0
    if (settlement_note !== undefined) update.settlement_note = settlement_note

    const { error } = await supabaseAdmin.from('care_bookings').update(update).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}
