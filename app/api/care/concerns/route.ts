import { NextRequest, NextResponse } from 'next/server'
import { requireFamilyActor, closureErrorResponse, parseId } from '@/lib/care/operations/http'
import { listOwnConcernStatuses, createOwnFamilyConcern } from '@/lib/care/operations/service'
import { parseCreateConcern } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireFamilyActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listOwnConcernStatuses(auth.actor) })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = await requireFamilyActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if ((body ?? {}).action !== 'create') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const bookingId = parseId(String(body.booking_id))
    const input = parseCreateConcern(body)
    const r = await createOwnFamilyConcern(bookingId, input, auth.actor)
    return NextResponse.json({ success: true, data: r })
  } catch (e) { return closureErrorResponse(e) }
}
