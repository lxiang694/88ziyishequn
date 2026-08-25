import { NextRequest, NextResponse } from 'next/server'
import { getCareOperationsOverview } from '@/lib/care/service'
import { CARE_ANY_PERMISSION, careErrorResponse, requireCarePermission } from '@/lib/care/http'

export const runtime = 'nodejs'

/** 只回本輪真實存在的計數，沒有營收、轉換率或服務人次 */
export async function GET(req: NextRequest) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getCareOperationsOverview() })
  } catch (e) {
    return careErrorResponse(e)
  }
}
