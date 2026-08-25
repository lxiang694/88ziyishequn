import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_READ_PERMISSION, FULFILMENT_PERMISSIONS,
  auditFulfilment, fulfilmentErrorResponse, parseId,
} from '@/lib/care/fulfilment/http'
import { parseGrantAuthorization } from '@/lib/care/fulfilment/validation'
import {
  getCareServiceDetail, setCareServiceEventVisibility,
  grantCareServiceAuthorization, revokeCareServiceAuthorization,
} from '@/lib/care/fulfilment/service'
import { CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_READ_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getCareServiceDetail(parseId(params.id)) })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.summary)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const bookingId = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'set_event_visibility': {
        const eventId = parseId(String((body as any)?.event_id ?? ''))
        const visible = (body as any)?.visible === true
        const r = await setCareServiceEventVisibility(eventId, visible, actor)
        await auditFulfilment(req, actor, 'care_event.visibility',
          { resource: 'care_service_event', resource_id: eventId, to_status: r.visibility })
        return NextResponse.json({ success: true })
      }
      case 'grant_authorization': {
        const { user_id, scope } = parseGrantAuthorization(body)
        await grantCareServiceAuthorization(bookingId, user_id, scope, actor)
        // 稽核不記 user_id，只記資源與範圍
        await auditFulfilment(req, actor, 'care_authorization.grant',
          { resource: 'care_service_authorization', resource_id: bookingId, reason_code: scope })
        return NextResponse.json({ success: true })
      }
      case 'revoke_authorization': {
        const authId = parseId(String((body as any)?.authorization_id ?? ''))
        await revokeCareServiceAuthorization(authId, actor)
        await auditFulfilment(req, actor, 'care_authorization.revoke',
          { resource: 'care_service_authorization', resource_id: authId })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
