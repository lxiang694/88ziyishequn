import { NextRequest, NextResponse } from 'next/server'
import { getIntake } from '@/lib/care/repository'
import {
  CARE_ANY_PERMISSION, CARE_PERMISSIONS, auditCare, careErrorResponse,
  parseId, requireCarePermission,
} from '@/lib/care/http'
import { parseDeclineIntake, parseRequestMoreInfo } from '@/lib/care/validation'
import {
  convertCareIntakeToCase, declineCareIntake,
  requestMoreCareIntakeInformation, startCareIntakeReview,
} from '@/lib/care/service'
import { CareInputError } from '@/lib/care/domain'

export const runtime = 'nodejs'

/** 詳情。含 limited_support_note，因此要求 intake 管理權限而非僅檢視。 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const row = await getIntake(parseId(params.id))
    if (!row) return NextResponse.json({ success: false, error: '找不到這筆初評' }, { status: 404 })
    return NextResponse.json({ success: true, data: row })
  } catch (e) {
    return careErrorResponse(e)
  }
}

/**
 * 固定 use case，沒有泛用 PATCH：action 只接受白名單。
 * client 不能自行指定 status、owner 或關聯關係。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCarePermission(req, CARE_PERMISSIONS.intake)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'start_review': {
        const r = await startCareIntakeReview(id, actor)
        await auditCare(req, actor, 'care_intake.review_start',
          { resource: 'care_intake', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'request_more_information': {
        const { review_note } = parseRequestMoreInfo(body)
        const r = await requestMoreCareIntakeInformation(id, review_note, actor)
        await auditCare(req, actor, 'care_intake.request_more_info',
          { resource: 'care_intake', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'decline': {
        const { reason_code, review_note } = parseDeclineIntake(body)
        const r = await declineCareIntake(id, reason_code, review_note, actor)
        await auditCare(req, actor, 'care_intake.decline',
          { resource: 'care_intake', resource_id: id, from_status: r.from, to_status: r.to, reason_code })
        return NextResponse.json({ success: true })
      }
      case 'convert_to_case': {
        const r = await convertCareIntakeToCase(id, actor)
        await auditCare(req, actor, 'care_intake.convert_to_case',
          { resource: 'care_case', resource_id: r.caseId, from_status: 'in_review', to_status: 'needs_assessment' })
        return NextResponse.json({ success: true, data: { case_id: r.caseId, case_no: r.caseNo } })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return careErrorResponse(e)
  }
}
