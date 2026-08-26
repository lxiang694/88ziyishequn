import { NextRequest, NextResponse } from 'next/server'
import { requireFamilyActor, closureErrorResponse } from '@/lib/care/operations/http'
import { listOwnFeedbackRequests } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireFamilyActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listOwnFeedbackRequests(auth.actor) })
  } catch (e) { return closureErrorResponse(e) }
}
