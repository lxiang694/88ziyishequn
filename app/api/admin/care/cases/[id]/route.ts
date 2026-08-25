import { NextRequest, NextResponse } from 'next/server'
import { getCase, getIntake, listQuotesForCase } from '@/lib/care/repository'
import {
  CARE_ANY_PERMISSION, CARE_PERMISSIONS, auditCare, careErrorResponse,
  parseId, requireCarePermission,
} from '@/lib/care/http'
import { parseCancelCase } from '@/lib/care/validation'
import { cancelCareCase, markCarePaymentReceived } from '@/lib/care/service'
import { CareInputError } from '@/lib/care/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const row = await getCase(id)
    if (!row) return NextResponse.json({ success: false, error: '找不到這個案件' }, { status: 404 })
    const [intake, quotes] = await Promise.all([
      getIntake(row.intake_id),
      listQuotesForCase(id),
    ])
    return NextResponse.json({ success: true, data: { case: row, intake, quotes } })
  } catch (e) {
    return careErrorResponse(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCarePermission(req, CARE_PERMISSIONS.case)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'cancel': {
        const { reason_code } = parseCancelCase(body)
        const r = await cancelCareCase(id, reason_code, actor)
        await auditCare(req, actor, 'care_case.cancel',
          { resource: 'care_case', resource_id: id, from_status: r.from, to_status: r.to, reason_code })
        return NextResponse.json({ success: true })
      }
      // ⚠️ 人工確認收款，不是金流證明；本輪不串接任何付款或對帳。
      case 'mark_payment_received': {
        const r = await markCarePaymentReceived(id, actor)
        await auditCare(req, actor, 'care_case.mark_payment_received',
          { resource: 'care_case', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return careErrorResponse(e)
  }
}
