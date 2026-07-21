import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'

export const runtime = 'nodejs'

const VALID_ACTIONS = new Set([
  'page_view', 'export_customers', 'export_event_registrations', 'export_orders', 'export_members',
])

// POST /api/admin/audit — 任何登入管理員記錄自己的操作
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  try {
    const { action, detail } = await req.json()
    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ success: false, error: '無效的動作' }, { status: 400 })
    }
    await writeAuditLog(req, admin, action, detail)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '記錄失敗' }, { status: 500 })
  }
}

// GET /api/admin/audit — 僅超級管理員查看日誌
//   ?type=downloads_count&since=<iso>  → 回傳下載筆數（給提示徽章）
//   ?scope=downloads|views|all&adminId=&date=YYYY-MM-DD&limit=  → 查詢日誌
export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)

  // 徽章用：回傳自 since 之後的下載筆數
  if (searchParams.get('type') === 'downloads_count') {
    const since = searchParams.get('since')
    let q = supabaseAdmin
      .from('admin_audit_logs')
      .select('id', { count: 'exact', head: true })
      .like('action', 'export_%')
    if (since) q = q.gt('created_at', since)
    const { count } = await q
    return NextResponse.json({ success: true, count: count || 0 })
  }

  const scope = searchParams.get('scope') || 'all'
  const adminId = searchParams.get('adminId') || ''
  const date = searchParams.get('date') || ''
  const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '300')))

  let q = supabaseAdmin
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (scope === 'downloads') q = q.like('action', 'export_%')
  else if (scope === 'views') q = q.eq('action', 'page_view')

  if (adminId) q = q.eq('admin_id', parseInt(adminId))

  if (date) {
    // date 為台灣日期，換算成 UTC 區間
    const start = new Date(date + 'T00:00:00+08:00').toISOString()
    const end = new Date(date + 'T23:59:59+08:00').toISOString()
    q = q.gte('created_at', start).lte('created_at', end)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data || [] })
}
