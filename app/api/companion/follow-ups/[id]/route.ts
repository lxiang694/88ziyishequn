import { NextRequest, NextResponse } from 'next/server'
import { requireStaffActor, closureErrorResponse, parseId } from '@/lib/care/operations/http'
import { completeCareQualityFollowUp } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireStaffActor(req)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const body = await req.json()
    if ((body ?? {}).action !== 'complete') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    // 第三個參數 true = 以陪診員身分，Service 會再檢查是不是自己的
    await completeCareQualityFollowUp(id, auth.actor, true)
    return NextResponse.json({ success: true })
  } catch (e) { return closureErrorResponse(e) }
}
