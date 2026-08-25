import { NextRequest, NextResponse } from 'next/server'
import { requireOwnStaff, staffingErrorResponse } from '@/lib/care/staffing/http'
import { listOwnProposalSummaries } from '@/lib/care/staffing/service'

export const runtime = 'nodejs'

/**
 * 只回自己未逾時的邀請，且一律是去敏感化摘要。
 * 接受前不會有就診人姓名、電話、醫院樓層、報價或初評備註。
 */
export async function GET(req: NextRequest) {
  const auth = requireOwnStaff(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listOwnProposalSummaries(auth.actor) })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
