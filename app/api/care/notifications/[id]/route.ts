import { NextRequest, NextResponse } from 'next/server'
import { requireFamilyActor, closureErrorResponse, parseId } from '@/lib/care/operations/http'
import { markOwnCareNotificationRead } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFamilyActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const body = await req.json()
    const action = (body ?? {}).action
    if (action !== 'mark_read' && action !== 'archive') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    await markOwnCareNotificationRead(
      id, { kind: 'family', userId: auth.actor.userId },
      action === 'archive' ? 'archived' : 'read')
    return NextResponse.json({ success: true })
  } catch (e) { return closureErrorResponse(e) }
}
