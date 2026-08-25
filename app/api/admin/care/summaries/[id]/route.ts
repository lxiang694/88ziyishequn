import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_PERMISSIONS, FULFILMENT_ANY_PERMISSION,
  auditFulfilment, fulfilmentErrorResponse, parseId,
} from '@/lib/care/fulfilment/http'
import { parseSummaryDraft, parseWithdrawSummary } from '@/lib/care/fulfilment/validation'
import {
  updateCareFamilySummaryDraft, submitCareFamilySummaryForReview,
  publishCareFamilySummary, withdrawCareFamilySummary,
} from '@/lib/care/fulfilment/service'
import { getSummary } from '@/lib/care/fulfilment/repository'
import { CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const row = await getSummary(parseId(params.id))
    if (!row) return NextResponse.json({ success: false, error: '找不到這份小結' }, { status: 404 })
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.summary)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'update_draft': {
        await updateCareFamilySummaryDraft(id, parseSummaryDraft(body), actor)
        await auditFulfilment(req, actor, 'care_summary.update_draft',
          { resource: 'care_family_summary', resource_id: id, to_status: 'draft' })
        return NextResponse.json({ success: true })
      }
      case 'submit_for_review': {
        const r = await submitCareFamilySummaryForReview(id, actor)
        await auditFulfilment(req, actor, 'care_summary.submit',
          { resource: 'care_family_summary', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'publish': {
        const r = await publishCareFamilySummary(id, actor)
        await auditFulfilment(req, actor, 'care_summary.publish',
          { resource: 'care_family_summary', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'withdraw': {
        const { reason_code } = parseWithdrawSummary(body)
        const r = await withdrawCareFamilySummary(id, reason_code, actor)
        await auditFulfilment(req, actor, 'care_summary.withdraw',
          { resource: 'care_family_summary', resource_id: id, from_status: r.from, to_status: r.to, reason_code })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
