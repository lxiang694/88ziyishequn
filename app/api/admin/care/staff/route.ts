import { NextRequest, NextResponse } from 'next/server'
import { requireStaffingPermission, STAFFING_ANY_PERMISSION, staffingErrorResponse } from '@/lib/care/staffing/http'
import { getStaffRoster, getMissingEmploymentList } from '@/lib/care/staffing/service'

export const runtime = 'nodejs'

/** 名冊：不含 password_hash、身分證、金融帳號等人事敏感欄位 */
export async function GET(req: NextRequest) {
  const auth = requireStaffingPermission(req, STAFFING_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const [roster, missing] = await Promise.all([getStaffRoster(), getMissingEmploymentList()])
    return NextResponse.json({ success: true, data: { roster, missing_employment: missing } })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
