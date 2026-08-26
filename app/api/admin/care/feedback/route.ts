import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import {
  listFeedbackForReview, reviewCareFeedback, createAuthorizedCareFeedbackRequest,
} from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.feedback)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listFeedbackForReview() })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.feedback)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    switch ((body ?? {}).action) {
      case 'create_request': {
        const bookingId = parseId(String(body.booking_id))
        const userId = String(body.recipient_user_id || '')
        if (!userId) return NextResponse.json({ success: false, error: '請指定收件人' }, { status: 400 })
        const r = await createAuthorizedCareFeedbackRequest(bookingId, userId, auth.actor)
        await auditClosure(req, auth.actor, 'care_feedback.request_create',
          { resource: 'care_feedback_request', resource_id: r.requestId })
        return NextResponse.json({ success: true, data: r })
      }
      case 'start_review': {
        const id = parseId(String(body.feedback_id))
        await reviewCareFeedback(id, 'under_review', auth.actor)
        await auditClosure(req, auth.actor, 'care_feedback.review_start',
          { resource: 'care_feedback', resource_id: id, to_status: 'under_review' })
        return NextResponse.json({ success: true })
      }
      case 'close': {
        const id = parseId(String(body.feedback_id))
        await reviewCareFeedback(id, 'closed', auth.actor)
        await auditClosure(req, auth.actor, 'care_feedback.close',
          { resource: 'care_feedback', resource_id: id, to_status: 'closed' })
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
  } catch (e) { return closureErrorResponse(e) }
}
