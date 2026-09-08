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

/** 沒有通用 PATCH：只有明確的三個動作 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = guard(req)
  if (auth instanceof NextResponse) return auth

  const id = Number(params.id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ success: false, error: '編號不正確' }, { status: 400 })
  }

  try {
    const body = await req.json()
    switch (body?.action) {
      case 'toggle': {
        // 開關是最常用的動作，單獨一個 action，不必送整份表單
        const next = body.is_active === true
        const { error } = await supabaseAdmin
          .from('site_popups').update({ is_active: next }).eq('id', id)
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        await writeAuditLog(req, auth.admin, 'site_popup.toggle',
          JSON.stringify({ resource: 'site_popup', resource_id: id, to_status: next ? 'active' : 'inactive' }))
        return NextResponse.json({ success: true })
      }
      case 'update': {
        const input = parsePopupInput(body)
        const { error } = await supabaseAdmin.from('site_popups').update(input).eq('id', id)
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        await writeAuditLog(req, auth.admin, 'site_popup.update',
          JSON.stringify({ resource: 'site_popup', resource_id: id }))
        return NextResponse.json({ success: true })
      }
      case 'delete': {
        const { error } = await supabaseAdmin.from('site_popups').delete().eq('id', id)
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        await writeAuditLog(req, auth.admin, 'site_popup.delete',
          JSON.stringify({ resource: 'site_popup', resource_id: id }))
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
  } catch (e) {
    if (e instanceof PopupInputError) {
      return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: '操作失敗' }, { status: 500 })
  }
}
