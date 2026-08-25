import { NextRequest, NextResponse } from 'next/server'
import {
  requireStaffingPermission, STAFFING_ANY_PERMISSION, STAFFING_PERMISSIONS,
  auditStaffing, staffingErrorResponse, parseId,
} from '@/lib/care/staffing/http'
import { listTimeOffByStatus } from '@/lib/care/staffing/repository'
import { parseReviewTimeOff } from '@/lib/care/staffing/validation'
import { reviewStaffTimeOffRequest } from '@/lib/care/staffing/service'
import { TIME_OFF_STATUSES, CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (TIME_OFF_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    return NextResponse.json({ success: true, data: await listTimeOffByStatus(status) })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_PERMISSIONS.timeOff)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const body = await req.json().catch(() => ({}))
    if (String((body as any)?.action || '') !== 'review') throw new CareInputError('不支援的操作')
    const id = parseId(String((body as any)?.request_id ?? ''))
    const { decision, review_note } = parseReviewTimeOff(body)
    const r = await reviewStaffTimeOffRequest(id, decision, review_note, actor)
    await auditStaffing(req, actor, 'care_time_off.review',
      { resource: 'staff_time_off_request', resource_id: id, from_status: r.from, to_status: r.to })
    return NextResponse.json({ success: true })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
