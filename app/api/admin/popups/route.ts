import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { POPUP_PERMISSION } from '@/lib/popups/domain'
import { parsePopupInput, PopupInputError } from '@/lib/popups/validation'

export const runtime = 'nodejs'

function guard(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const perms = auth.admin.permissions || []
  if (!perms.includes('all') && !perms.includes(POPUP_PERMISSION)) {
    return NextResponse.json({ success: false, error: '您沒有管理彈窗的權限' }, { status: 403 })
  }
  return auth
}

export async function GET(req: NextRequest) {
  const auth = guard(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin
    .from('site_popups').select('*')
    .order('priority', { ascending: false }).order('id', { ascending: false })
  if (error) {
    if ((error as any).code === '42P01') {
      return NextResponse.json({
        success: false, table_missing: true,
        error: '彈窗資料表尚未建立，請先執行 migrations/site_popups_schema.sql',
      }, { status: 503 })
    }
    return NextResponse.json({ success: false, error: '讀取失敗' }, { status: 500 })
  }
  return NextResponse.json({ success: true, data: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = guard(req)
  if (auth instanceof NextResponse) return auth
  try {
    const input = parsePopupInput(await req.json())
    const { data, error } = await supabaseAdmin
      .from('site_popups')
      .insert({ ...input, created_by_admin_id: auth.admin.id })
      .select('id').single()
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    await writeAuditLog(req, auth.admin, 'site_popup.create',
      JSON.stringify({ resource: 'site_popup', resource_id: (data as any).id }))
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (e instanceof PopupInputError) {
      return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: '新增失敗' }, { status: 500 })
  }
}
