import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_PERMISSIONS,
  auditFulfilment, fulfilmentErrorResponse, parseId,
} from '@/lib/care/fulfilment/http'
import { listSettlementLines, listBatches } from '@/lib/care/fulfilment/repository'
import { parseManualLine, parseReviewLine, parseBatchPeriod } from '@/lib/care/fulfilment/validation'
import {
  generatePendingPartTimeSettlementLine, createManualSettlementLine,
  reviewCareSettlementLine, createCareSettlementBatch,
  approveCareSettlementBatch, publishCareSettlementBatch, closeCareSettlementBatch,
} from '@/lib/care/fulfilment/service'
import { LINE_STATUSES, CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

/**
 * 金額只對具 care_settlement.manage 的帳號開放。
 * 一般營運、HR、督導即使都在 Admin portal 也讀不到。
 */
export async function GET(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.settlement)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (LINE_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    const [lines, batches] = await Promise.all([listSettlementLines(status), listBatches()])
    return NextResponse.json({ success: true, data: { lines, batches } })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.settlement)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'generate_line': {
        const bookingId = parseId(String((body as any)?.booking_id ?? ''))
        const r = await generatePendingPartTimeSettlementLine(bookingId, actor)
        if (r.created) {
          await auditFulfilment(req, actor, 'care_settlement.line_generate',
            { resource: 'care_settlement_line', resource_id: r.lineId, to_status: 'pending_review' })
        }
        return NextResponse.json({ success: true, data: { line_id: r.lineId, created: r.created } })
      }
      case 'create_manual_line': {
        const bookingId = parseId(String((body as any)?.booking_id ?? ''))
        const r = await createManualSettlementLine(bookingId, parseManualLine(body), actor)
        await auditFulfilment(req, actor, 'care_settlement.line_manual',
          { resource: 'care_settlement_line', resource_id: r.lineId, to_status: 'pending_review' })
        return NextResponse.json({ success: true, data: { line_id: r.lineId } })
      }
      case 'review_line': {
        const lineId = parseId(String((body as any)?.line_id ?? ''))
        const { decision, review_note } = parseReviewLine(body)
        const r = await reviewCareSettlementLine(lineId, decision, review_note, actor)
        await auditFulfilment(req, actor, 'care_settlement.line_review',
          { resource: 'care_settlement_line', resource_id: lineId, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'create_batch': {
        const { period_start, period_end } = parseBatchPeriod(body)
        const ids = Array.isArray((body as any)?.line_ids)
          ? (body as any).line_ids.filter((n: unknown) => Number.isInteger(n) && (n as number) > 0)
          : []
        const r = await createCareSettlementBatch(period_start, period_end, ids, actor)
        await auditFulfilment(req, actor, 'care_settlement.batch_create',
          { resource: 'care_settlement_batch', resource_id: r.batchId, to_status: 'draft' })
        return NextResponse.json({ success: true, data: { batch_id: r.batchId, batch_no: r.batchNo } })
      }
      case 'approve_batch': {
        const batchId = parseId(String((body as any)?.batch_id ?? ''))
        const r = await approveCareSettlementBatch(batchId, actor)
        await auditFulfilment(req, actor, 'care_settlement.batch_approve',
          { resource: 'care_settlement_batch', resource_id: batchId, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'publish_batch': {
        const batchId = parseId(String((body as any)?.batch_id ?? ''))
        const r = await publishCareSettlementBatch(batchId, actor)
        await auditFulfilment(req, actor, 'care_settlement.batch_publish',
          { resource: 'care_settlement_batch', resource_id: batchId, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'close_batch': {
        const batchId = parseId(String((body as any)?.batch_id ?? ''))
        const r = await closeCareSettlementBatch(batchId, actor)
        await auditFulfilment(req, actor, 'care_settlement.batch_close',
          { resource: 'care_settlement_batch', resource_id: batchId, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
