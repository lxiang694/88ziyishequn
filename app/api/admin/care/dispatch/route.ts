import { NextRequest, NextResponse } from 'next/server'
import {
  requireStaffingPermission, STAFFING_ANY_PERMISSION, STAFFING_PERMISSIONS,
  auditStaffing, staffingErrorResponse, parseId,
} from '@/lib/care/staffing/http'
import { listMatchableCases, listUnassignedBookings } from '@/lib/care/staffing/repository'
import { parseCreateProposal } from '@/lib/care/staffing/validation'
import {
  listDispatchCandidates, createFullTimeAssignment,
  createPartTimeDispatchProposal, materializeCareCaseBooking,
} from '@/lib/care/staffing/service'
import { EMPLOYMENT_TYPES, CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

/** 待媒合案件、未指派服務，或某筆服務的候選人評估 */
export async function GET(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const sp = new URL(req.url).searchParams
    const bookingId = sp.get('booking_id')
    if (bookingId) {
      const raw = sp.get('employment_type') || 'part_time'
      if (!(EMPLOYMENT_TYPES as readonly string[]).includes(raw)) {
        throw new CareInputError('僱用型態不是允許的選項', 'employment_type')
      }
      return NextResponse.json({
        success: true,
        data: await listDispatchCandidates(parseId(bookingId), raw as any),
      })
    }
    const [cases, bookings] = await Promise.all([listMatchableCases(), listUnassignedBookings()])
    return NextResponse.json({ success: true, data: { cases, bookings } })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_PERMISSIONS.dispatch)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'materialize_case': {
        const caseId = parseId(String((body as any)?.case_id ?? ''))
        const r = await materializeCareCaseBooking(caseId, actor)
        if (r.created) {
          await auditStaffing(req, actor, 'care_dispatch.materialize',
            { resource: 'care_booking', resource_id: r.bookingId })
        }
        return NextResponse.json({ success: true, data: { booking_id: r.bookingId, created: r.created } })
      }
      case 'assign_full_time': {
        const bookingId = parseId(String((body as any)?.booking_id ?? ''))
        const companionId = parseId(String((body as any)?.companion_id ?? ''))
        await createFullTimeAssignment(bookingId, companionId, actor)
        await auditStaffing(req, actor, 'care_dispatch.assign_full_time',
          { resource: 'care_booking', resource_id: bookingId, to_status: '已派工' })
        return NextResponse.json({ success: true })
      }
      case 'create_proposal': {
        const bookingId = parseId(String((body as any)?.booking_id ?? ''))
        const { companion_id, expires_in_hours } = parseCreateProposal(body)
        const r = await createPartTimeDispatchProposal(bookingId, companion_id, expires_in_hours, actor)
        await auditStaffing(req, actor, 'care_dispatch.proposal_create',
          { resource: 'care_dispatch_proposal', resource_id: r.proposalId, to_status: 'proposed' })
        return NextResponse.json({ success: true, data: { proposal_id: r.proposalId } })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
