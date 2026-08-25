import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_PERMISSIONS,
  auditFulfilment, fulfilmentErrorResponse, parseId,
} from '@/lib/care/fulfilment/http'
import { parseResolveIncident } from '@/lib/care/fulfilment/validation'
import {
  acknowledgeCareIncident, resolveCareIncident, closeCareIncident,
  markCareIncidentNotificationPrepared,
} from '@/lib/care/fulfilment/service'
import { CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

/**
 * 異常事件的督導操作。
 * ⚠️ 沒有 mark_sent：系統沒有串接任何通知管道，
 * 最多只能推進到「已備妥通知內容」，由人工實際聯繫。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.incident)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'acknowledge': {
        const r = await acknowledgeCareIncident(id, actor)
        await auditFulfilment(req, actor, 'care_incident.acknowledge',
          { resource: 'care_incident', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'resolve': {
        const { resolution_code } = parseResolveIncident(body)
        const r = await resolveCareIncident(id, resolution_code, actor)
        await auditFulfilment(req, actor, 'care_incident.resolve',
          { resource: 'care_incident', resource_id: id, from_status: r.from, to_status: r.to, reason_code: resolution_code })
        return NextResponse.json({ success: true })
      }
      case 'close': {
        const r = await closeCareIncident(id, actor)
        await auditFulfilment(req, actor, 'care_incident.close',
          { resource: 'care_incident', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'prepare_notification': {
        const r = await markCareIncidentNotificationPrepared(id, actor)
        await auditFulfilment(req, actor, 'care_incident.notification',
          { resource: 'care_incident', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true, data: { notification_status: r.to } })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
