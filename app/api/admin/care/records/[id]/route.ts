import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_PERMISSIONS, FULFILMENT_ANY_PERMISSION,
  auditFulfilment, fulfilmentErrorResponse, parseId,
} from '@/lib/care/fulfilment/http'
import { parseReturnRecord } from '@/lib/care/fulfilment/validation'
import { returnCareServiceRecordForRevision, reviewCareServiceRecord } from '@/lib/care/fulfilment/service'
import { getRecord } from '@/lib/care/fulfilment/repository'
import { CareInputError } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const row = await getRecord(parseId(params.id))
    if (!row) return NextResponse.json({ success: false, error: '找不到這份服務紀錄' }, { status: 404 })
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_PERMISSIONS.record)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'review': {
        const r = await reviewCareServiceRecord(id, actor)
        await auditFulfilment(req, actor, 'care_record.review',
          { resource: 'care_service_record', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'return_for_revision': {
        const { reason_code } = parseReturnRecord(body)
        const r = await returnCareServiceRecordForRevision(id, reason_code, actor)
        await auditFulfilment(req, actor, 'care_record.return',
          { resource: 'care_service_record', resource_id: id, from_status: r.from, to_status: r.to, reason_code })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
