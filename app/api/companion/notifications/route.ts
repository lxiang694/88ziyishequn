import { NextRequest, NextResponse } from 'next/server'
import { requireStaffActor, closureErrorResponse } from '@/lib/care/operations/http'
import {
  listOwnStaffNotifications, listOwnNotificationPreferences,
  updateOwnCareNotificationPreference,
} from '@/lib/care/operations/service'
import { parseNotificationPreference } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireStaffActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    const owner = { kind: 'staff' as const, companionId: auth.actor.id }
    const [items, preferences] = await Promise.all([
      listOwnStaffNotifications(auth.actor),
      listOwnNotificationPreferences(owner),
    ])
    return NextResponse.json({ success: true, data: { items, preferences } })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireStaffActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if ((body ?? {}).action !== 'update_preference') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const input = parseNotificationPreference(body)
    await updateOwnCareNotificationPreference(
      input, { kind: 'staff', companionId: auth.actor.id })
    return NextResponse.json({ success: true })
  } catch (e) { return closureErrorResponse(e) }
}
