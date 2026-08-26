import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, OPERATIONS_READ_PERMISSION,
  closureErrorResponse, auditClosure,
} from '@/lib/care/operations/http'
import { listConcernsForAdmin } from '@/lib/care/operations/service'
import { parseAdminCreateConcern } from '@/lib/care/operations/validation'
import * as svc from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, OPERATIONS_READ_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const status = new URL(req.url).searchParams.get('status') || undefined
    return NextResponse.json({ success: true, data: await listConcernsForAdmin(status) })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.concern)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if ((body ?? {}).action !== 'create') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const input = parseAdminCreateConcern(body)
    const bookingId = body.booking_id ? Number(body.booking_id) : null
    const r = await svc.createOperationsConcern(bookingId, input, auth.actor)
    await auditClosure(req, auth.actor, 'care_concern.create',
      { resource: 'care_concern', resource_id: r.concernId, reason_code: input.category })
    return NextResponse.json({ success: true, data: r })
  } catch (e) { return closureErrorResponse(e) }
}
