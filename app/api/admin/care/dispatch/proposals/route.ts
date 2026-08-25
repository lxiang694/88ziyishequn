import { NextRequest, NextResponse } from 'next/server'
import { requireStaffingPermission, STAFFING_ANY_PERMISSION, staffingErrorResponse } from '@/lib/care/staffing/http'
import { listProposals, expireStaleProposals } from '@/lib/care/staffing/repository'
import { PROPOSAL_STATUSES } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    // 順手把過期的標記掉，避免清單長期顯示錯誤狀態
    await expireStaleProposals()
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (PROPOSAL_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    return NextResponse.json({ success: true, data: await listProposals(status) })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
