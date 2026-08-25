import { NextRequest, NextResponse } from 'next/server'
import { requireOwnStaff, staffingErrorResponse, parseId } from '@/lib/care/staffing/http'
import { parseDeclineProposal } from '@/lib/care/staffing/validation'
import { acceptOwnDispatchProposal, declineOwnDispatchProposal } from '@/lib/care/staffing/service'
import { CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

/**
 * 接受／婉拒。
 * 接受的並發保護在資料庫函式裡：兩人同時按，最多一個成功。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireOwnStaff(req)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    if (action === 'accept') {
      const r = await acceptOwnDispatchProposal(id, actor)
      return NextResponse.json({ success: true, data: { booking_id: r.bookingId } })
    }
    if (action === 'decline') {
      const { reason_code, note } = parseDeclineProposal(body)
      await declineOwnDispatchProposal(id, reason_code, note, actor)
      return NextResponse.json({ success: true })
    }
    throw new CareInputError('不支援的操作')
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
