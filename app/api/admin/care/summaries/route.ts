import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_ANY_PERMISSION, FULFILMENT_PERMISSIONS,
  auditFulfilment, fulfilmentErrorResponse,
} from '@/lib/care/fulfilment/http'
import { listSummaries } from '@/lib/care/fulfilment/repository'
import { parseSummaryDraft } from '@/lib/care/fulfilment/validation'
import { createCareFamilySummaryDraft } from '@/lib/care/fulfilment/service'
import { SUMMARY_STATUSES, CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (SUMMARY_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    return NextResponse.json({ success: true, data: await listSummaries(status) })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}

/** 建立草稿：只有具 care_summary.review 的督導可以做 */
export async function POST(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.summary)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const body = await req.json().catch(() => ({}))
    const bookingId = Number((body as any)?.booking_id)
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      throw new CareInputError('缺少服務識別碼', 'booking_id')
    }
    const r = await createCareFamilySummaryDraft(bookingId, parseSummaryDraft(body), actor)
    await auditFulfilment(req, actor, 'care_summary.draft_create',
      { resource: 'care_family_summary', resource_id: r.summaryId, to_status: 'draft' })
    return NextResponse.json({ success: true, data: { summary_id: r.summaryId, version: r.version } })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
