import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'
import { getTWDateRange, toTWDate, listTWDays } from '@/lib/adminDateRange'

export const runtime = 'nodejs'

const BATCH = 1000
const MAX_ROWS = 100000 // 安全上限，避免極端情況拉爆記憶體

export async function GET(req: NextRequest) {
  // 流量資料僅限超級管理員查看
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const dateRange = searchParams.get('dateRange') || '7days'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''

  const { start, end } = getTWDateRange(dateRange, startDate, endDate)

  // 分批抓取範圍內所有瀏覽紀錄（只取統計需要的欄位）
  const rows: { visitor_id: string | null; path: string; created_at: string; user_id: string | null }[] = []
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { data, error } = await supabaseAdmin
      .from('page_views')
      .select('visitor_id, path, created_at, user_id')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .range(from, from + BATCH - 1)

    if (error) {
      // 表尚未建立時回傳空資料而非報錯
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, data: emptyData(start, end), table_missing: true })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) break
    rows.push(...(data as any))
    if (data.length < BATCH) break
  }

  // 總覽：PV（總瀏覽）、UV（不重複訪客）、會員瀏覽數
  const pv = rows.length
  const visitorSet = new Set<string>()
  let memberViews = 0
  for (const r of rows) {
    if (r.visitor_id) visitorSet.add(r.visitor_id)
    if (r.user_id) memberViews++
  }
  const uv = visitorSet.size

  // 依日趨勢（台灣時區），補齊空白日
  const dayPv = new Map<string, number>()
  const daySetUv = new Map<string, Set<string>>()
  for (const r of rows) {
    const day = toTWDate(r.created_at)
    dayPv.set(day, (dayPv.get(day) || 0) + 1)
    if (r.visitor_id) {
      if (!daySetUv.has(day)) daySetUv.set(day, new Set())
      daySetUv.get(day)!.add(r.visitor_id)
    }
  }
  const days = listTWDays(toTWDate(start), toTWDate(end))
  const trend = days.map(day => ({
    date: day,
    pv: dayPv.get(day) || 0,
    uv: daySetUv.get(day)?.size || 0,
  }))

  // 熱門頁面 Top 20
  const pathPv = new Map<string, number>()
  const pathUv = new Map<string, Set<string>>()
  for (const r of rows) {
    pathPv.set(r.path, (pathPv.get(r.path) || 0) + 1)
    if (r.visitor_id) {
      if (!pathUv.has(r.path)) pathUv.set(r.path, new Set())
      pathUv.get(r.path)!.add(r.visitor_id)
    }
  }
  const top_paths = Array.from(pathPv.entries())
    .map(([path, count]) => ({ path, pv: count, uv: pathUv.get(path)?.size || 0 }))
    .sort((a, b) => b.pv - a.pv)
    .slice(0, 20)

  return NextResponse.json({
    success: true,
    data: {
      summary: { pv, uv, member_views: memberViews },
      trend,
      top_paths,
    },
  })
}

function emptyData(start: string, end: string) {
  const days = listTWDays(toTWDate(start), toTWDate(end))
  return {
    summary: { pv: 0, uv: 0, member_views: 0 },
    trend: days.map(date => ({ date, pv: 0, uv: 0 })),
    top_paths: [],
  }
}
