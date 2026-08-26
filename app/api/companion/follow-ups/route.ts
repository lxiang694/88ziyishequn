import { NextRequest, NextResponse } from 'next/server'
import { requireStaffActor, closureErrorResponse } from '@/lib/care/operations/http'
import { listOwnQualityFollowUps } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

/** 只回傳去識別化摘要：不含督導備註、家屬回饋原文或分數 */
export async function GET(req: NextRequest) {
  const auth = requireStaffActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listOwnQualityFollowUps(auth.actor) })
  } catch (e) { return closureErrorResponse(e) }
}
