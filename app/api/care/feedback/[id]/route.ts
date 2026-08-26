import { NextRequest, NextResponse } from 'next/server'
import { requireFamilyActor, closureErrorResponse, parseId } from '@/lib/care/operations/http'
import { submitOwnAuthorizedCareFeedback } from '@/lib/care/operations/service'
import { parseSubmitFeedback } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFamilyActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const body = await req.json()
    if ((body ?? {}).action !== 'submit') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const input = parseSubmitFeedback(body)
    const r = await submitOwnAuthorizedCareFeedback(id, input, auth.actor)
    return NextResponse.json({ success: true, data: r })
  } catch (e) { return closureErrorResponse(e) }
}
