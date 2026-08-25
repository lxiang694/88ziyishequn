import { NextRequest, NextResponse } from 'next/server'
import {
  requireStaffingPermission, STAFFING_PERMISSIONS,
  auditStaffing, staffingErrorResponse, parseId,
} from '@/lib/care/staffing/http'
import { cancelDispatchProposal, expireDispatchProposal } from '@/lib/care/staffing/service'
import { CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireStaffingPermission(req, STAFFING_PERMISSIONS.dispatch)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    if (action === 'cancel') {
      const r = await cancelDispatchProposal(id, actor)
      await auditStaffing(req, actor, 'care_dispatch.proposal_cancel',
        { resource: 'care_dispatch_proposal', resource_id: id, from_status: r.from, to_status: r.to })
      return NextResponse.json({ success: true })
    }
    if (action === 'expire') {
      const r = await expireDispatchProposal(id, actor)
      await auditStaffing(req, actor, 'care_dispatch.proposal_expire',
        { resource: 'care_dispatch_proposal', resource_id: id, from_status: r.from, to_status: r.to })
      return NextResponse.json({ success: true })
    }
    throw new CareInputError('不支援的操作')
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
