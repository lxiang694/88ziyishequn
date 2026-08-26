import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import {
  acknowledgeCareConcern, assignCareConcernOwner, resolveCareConcern, closeCareConcern,
} from '@/lib/care/operations/service'
import { parseAssignConcern, parseResolveConcern } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.concern)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const body = await req.json()
    switch ((body ?? {}).action) {
      case 'acknowledge': {
        await acknowledgeCareConcern(id, auth.actor)
        await auditClosure(req, auth.actor, 'care_concern.acknowledge',
          { resource: 'care_concern', resource_id: id, to_status: 'acknowledged' })
        return NextResponse.json({ success: true })
      }
      case 'assign': {
        const { owner_admin_id, due_date } = parseAssignConcern(body)
        await assignCareConcernOwner(id, owner_admin_id, due_date, auth.actor)
        await auditClosure(req, auth.actor, 'care_concern.assign',
          { resource: 'care_concern', resource_id: id })
        return NextResponse.json({ success: true })
      }
      case 'resolve': {
        const { resolution_code, internal_note } = parseResolveConcern(body)
        await resolveCareConcern(id, resolution_code, internal_note, auth.actor)
        await auditClosure(req, auth.actor, 'care_concern.resolve',
          { resource: 'care_concern', resource_id: id, to_status: 'resolved', reason_code: resolution_code })
        return NextResponse.json({ success: true })
      }
      case 'close': {
        await closeCareConcern(id, auth.actor)
        await auditClosure(req, auth.actor, 'care_concern.close',
          { resource: 'care_concern', resource_id: id, to_status: 'closed' })
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
  } catch (e) { return closureErrorResponse(e) }
}
