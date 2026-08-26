import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, OPERATIONS_READ_PERMISSION,
  closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import { getQualityAdminView, createCareQualityReview } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, OPERATIONS_READ_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const status = new URL(req.url).searchParams.get('status') || undefined
    return NextResponse.json({ success: true, data: await getQualityAdminView(status) })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.qualityReview)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if ((body ?? {}).action !== 'create_review') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const bookingId = parseId(String(body.booking_id))
    const r = await createCareQualityReview(bookingId, auth.actor)
    await auditClosure(req, auth.actor, 'care_quality.review_create',
      { resource: 'care_quality_review', resource_id: r.reviewId })
    return NextResponse.json({ success: true, data: r })
  } catch (e) { return closureErrorResponse(e) }
}
