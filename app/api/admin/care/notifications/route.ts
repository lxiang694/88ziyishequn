import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import { getNotificationAdminView, suppressCareNotificationOutboxItem } from '@/lib/care/operations/service'
import { parseSuppressOutbox } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.notification)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getNotificationAdminView() })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.notification)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const action = (body ?? {}).action
    // 刻意只有「抑制」一個動作：沒有 provider，就沒有「送出」可以按
    if (action === 'suppress_outbox') {
      const id = parseId(String(body.outbox_id))
      const { reason_code } = parseSuppressOutbox(body)
      await suppressCareNotificationOutboxItem(id, reason_code, auth.actor)
      await auditClosure(req, auth.actor, 'care_notification.outbox_suppress',
        { resource: 'care_notification_outbox', resource_id: id, reason_code })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
  } catch (e) { return closureErrorResponse(e) }
}
