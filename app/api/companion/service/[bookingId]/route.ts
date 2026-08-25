import { NextRequest, NextResponse } from 'next/server'
import {
  requireStaff, fulfilmentErrorResponse, parseId,
} from '@/lib/care/fulfilment/http'
import {
  parseAppendEvent, parseInvalidateEvent, parseRecordDraft, parseIncident,
} from '@/lib/care/fulfilment/validation'
import {
  appendOwnCareServiceEvent, invalidateOwnCareServiceEvent,
  saveOwnCareServiceRecordDraft, submitOwnCareServiceRecord,
  createOwnCareIncident, getOwnServiceWorkspace,
} from '@/lib/care/fulfilment/service'
import { CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

/** 陪診員的服務履約工作區。歸屬檢查在 Service 層，不靠前端隱藏。 */
export async function GET(req: NextRequest, { params }: { params: { bookingId: string } }) {
  const auth = requireStaff(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({
      success: true,
      data: await getOwnServiceWorkspace(parseId(params.bookingId), auth.actor),
    })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}

/** 固定 action，沒有泛用更新 */
export async function POST(req: NextRequest, { params }: { params: { bookingId: string } }) {
  const auth = requireStaff(req)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const bookingId = parseId(params.bookingId)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'append_event': {
        const r = await appendOwnCareServiceEvent(bookingId, parseAppendEvent(body), actor)
        return NextResponse.json({ success: true, data: { event_id: r.eventId } })
      }
      case 'invalidate_event': {
        const eventId = parseId(String((body as any)?.event_id ?? ''))
        const { reason_code } = parseInvalidateEvent(body)
        await invalidateOwnCareServiceEvent(eventId, reason_code, actor)
        return NextResponse.json({ success: true })
      }
      case 'save_record_draft': {
        const r = await saveOwnCareServiceRecordDraft(bookingId, parseRecordDraft(body), actor)
        return NextResponse.json({ success: true, data: { record_id: r.recordId, status: r.status } })
      }
      case 'submit_record': {
        const r = await submitOwnCareServiceRecord(bookingId, actor)
        return NextResponse.json({ success: true, data: { record_id: r.recordId } })
      }
      case 'create_incident': {
        const r = await createOwnCareIncident(bookingId, parseIncident(body), actor)
        return NextResponse.json({ success: true, data: { incident_id: r.incidentId } })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
