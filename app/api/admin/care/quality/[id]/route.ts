import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import {
  startCareQualityReview, completeCareQualityReview, createCareQualityFollowUp,
  completeCareQualityFollowUp, verifyCareQualityFollowUp,
} from '@/lib/care/operations/service'
import { parseCompleteQualityReview, parseCreateFollowUp } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const action = (body ?? {}).action
  // 建立與完成改善事項屬於品質管理，覆核本身屬於品質覆核
  const needed = action === 'create_follow_up' || action === 'verify_follow_up'
    ? CLOSURE_PERMISSIONS.qualityManage
    : CLOSURE_PERMISSIONS.qualityReview
  const auth = requireClosurePermission(req, needed)
  if (auth instanceof NextResponse) return auth

  try {
    const id = parseId(params.id)
    switch (action) {
      case 'start': {
        await startCareQualityReview(id, auth.actor)
        await auditClosure(req, auth.actor, 'care_quality.review_start',
          { resource: 'care_quality_review', resource_id: id, to_status: 'in_review' })
        return NextResponse.json({ success: true })
      }
      case 'complete': {
        const input = parseCompleteQualityReview(body)
        await completeCareQualityReview(id, input, auth.actor)
        await auditClosure(req, auth.actor, 'care_quality.review_complete',
          { resource: 'care_quality_review', resource_id: id,
            to_status: input.needs_follow_up ? 'follow_up_required' : 'completed' })
        return NextResponse.json({ success: true })
      }
      case 'create_follow_up': {
        const input = parseCreateFollowUp(body)
        const r = await createCareQualityFollowUp(id, input, auth.actor)
        await auditClosure(req, auth.actor, 'care_quality.follow_up_create',
          { resource: 'care_quality_follow_up', resource_id: r.followUpId, reason_code: input.action_code })
        return NextResponse.json({ success: true, data: r })
      }
      case 'complete_follow_up': {
        await completeCareQualityFollowUp(id, auth.actor, false)
        await auditClosure(req, auth.actor, 'care_quality.follow_up_complete',
          { resource: 'care_quality_follow_up', resource_id: id, to_status: 'completed' })
        return NextResponse.json({ success: true })
      }
      case 'verify_follow_up': {
        await verifyCareQualityFollowUp(id, auth.actor)
        await auditClosure(req, auth.actor, 'care_quality.follow_up_verify',
          { resource: 'care_quality_follow_up', resource_id: id, to_status: 'verified' })
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
  } catch (e) { return closureErrorResponse(e) }
}
