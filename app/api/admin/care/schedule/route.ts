import { NextRequest, NextResponse } from 'next/server'
import { requireStaffingPermission, STAFFING_ANY_PERMISSION, staffingErrorResponse } from '@/lib/care/staffing/http'
import { getScheduleOverview } from '@/lib/care/staffing/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getScheduleOverview() })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
