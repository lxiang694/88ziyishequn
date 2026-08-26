import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure,
} from '@/lib/care/operations/http'
import { listCareDataLifecycleReviews, createCareDataLifecycleReview } from '@/lib/care/operations/service'
import { parseCreateLifecycleReview } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.lifecycle)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listCareDataLifecycleReviews() })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.lifecycle)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if ((body ?? {}).action !== 'create') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const input = parseCreateLifecycleReview(body)
    const r = await createCareDataLifecycleReview(input, auth.actor)
    await auditClosure(req, auth.actor, 'care_data_lifecycle.create',
      { resource: 'care_data_lifecycle_review', resource_id: r.reviewId, reason_code: input.reason_code })
    return NextResponse.json({ success: true, data: r })
  } catch (e) { return closureErrorResponse(e) }
}
