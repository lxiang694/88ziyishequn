import { NextRequest, NextResponse } from 'next/server'
import {
  requireStaffingPermission, STAFFING_ANY_PERMISSION, STAFFING_PERMISSIONS,
  auditStaffing, staffingErrorResponse, parseId,
} from '@/lib/care/staffing/http'
import {
  parseEmploymentTerm, parseRegion, parseVerifyCapability,
} from '@/lib/care/staffing/validation'
import {
  getStaffDetail, createStaffEmploymentTerm, endStaffEmploymentTerm,
  pauseStaffEmploymentTerm, resumeStaffEmploymentTerm,
  addStaffServiceRegion, removeStaffServiceRegion,
  verifyStaffCapability, expireStaffCapabilityVerification,
  suspendStaffCapabilityVerification,
} from '@/lib/care/staffing/service'
import { CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireStaffingPermission(req, STAFFING_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getStaffDetail(parseId(params.id)) })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}

/** 固定 action。能力驗證需要 credential 權限，其餘需要 staff 權限。 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const action = String((body as any)?.action || '')
  const credentialActions = ['verify_capability', 'expire_capability', 'suspend_capability']
  const needed = credentialActions.includes(action)
    ? STAFFING_PERMISSIONS.credential
    : STAFFING_PERMISSIONS.staff

  const auth = requireStaffingPermission(req, needed)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    switch (action) {
      case 'create_employment_term': {
        const r = await createStaffEmploymentTerm(id, parseEmploymentTerm(body), actor)
        await auditStaffing(req, actor, 'care_staff.employment_create',
          { resource: 'staff_employment_term', resource_id: r.termId, to_status: 'active' })
        return NextResponse.json({ success: true })
      }
      case 'end_employment_term': {
        const termId = parseId(String((body as any)?.term_id ?? ''))
        const endDate = String((body as any)?.end_date || '')
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new CareInputError('結束日格式須為 YYYY-MM-DD', 'end_date')
        await endStaffEmploymentTerm(termId, endDate, actor)
        await auditStaffing(req, actor, 'care_staff.employment_end',
          { resource: 'staff_employment_term', resource_id: termId, to_status: 'ended' })
        return NextResponse.json({ success: true })
      }
      case 'pause_employment_term': {
        const termId = parseId(String((body as any)?.term_id ?? ''))
        await pauseStaffEmploymentTerm(termId, actor)
        await auditStaffing(req, actor, 'care_staff.employment_pause',
          { resource: 'staff_employment_term', resource_id: termId, to_status: 'paused' })
        return NextResponse.json({ success: true })
      }
      case 'resume_employment_term': {
        const termId = parseId(String((body as any)?.term_id ?? ''))
        await resumeStaffEmploymentTerm(termId, actor)
        await auditStaffing(req, actor, 'care_staff.employment_resume',
          { resource: 'staff_employment_term', resource_id: termId, to_status: 'active' })
        return NextResponse.json({ success: true })
      }
      case 'add_region': {
        const { region } = parseRegion(body)
        await addStaffServiceRegion(id, region, actor)
        await auditStaffing(req, actor, 'care_staff.region_add',
          { resource: 'staff_service_region', resource_id: id })
        return NextResponse.json({ success: true })
      }
      case 'remove_region': {
        const { region } = parseRegion(body)
        await removeStaffServiceRegion(id, region, actor)
        await auditStaffing(req, actor, 'care_staff.region_remove',
          { resource: 'staff_service_region', resource_id: id })
        return NextResponse.json({ success: true })
      }
      case 'verify_capability': {
        const input = parseVerifyCapability(body)
        await verifyStaffCapability(id, input, actor)
        await auditStaffing(req, actor, 'care_staff.capability_verify',
          { resource: 'staff_capability_verification', resource_id: id, reason_code: input.capability_code })
        return NextResponse.json({ success: true })
      }
      case 'expire_capability': {
        const code = String((body as any)?.capability_code || '')
        await expireStaffCapabilityVerification(id, code, actor)
        await auditStaffing(req, actor, 'care_staff.capability_expire',
          { resource: 'staff_capability_verification', resource_id: id, reason_code: code })
        return NextResponse.json({ success: true })
      }
      case 'suspend_capability': {
        const code = String((body as any)?.capability_code || '')
        await suspendStaffCapabilityVerification(id, code, actor)
        await auditStaffing(req, actor, 'care_staff.capability_suspend',
          { resource: 'staff_capability_verification', resource_id: id, reason_code: code })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
