import { NextRequest, NextResponse } from 'next/server'
import { requireOwnStaff, staffingErrorResponse, parseId } from '@/lib/care/staffing/http'
import { parseTimeOff } from '@/lib/care/staffing/validation'
import { getOwnTimeOff, submitOwnTimeOffRequest, cancelOwnTimeOffRequest } from '@/lib/care/staffing/service'
import { CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireOwnStaff(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getOwnTimeOff(auth.actor) })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = requireOwnStaff(req)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || 'submit')

    if (action === 'submit') {
      const r = await submitOwnTimeOffRequest(parseTimeOff(body), actor)
      return NextResponse.json({ success: true, data: { request_id: r.requestId } })
    }
    if (action === 'cancel') {
      const id = parseId(String((body as any)?.request_id ?? ''))
      await cancelOwnTimeOffRequest(id, actor)
      return NextResponse.json({ success: true })
    }
    throw new CareInputError('不支援的操作')
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
