import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, fulfilmentErrorResponse } from '@/lib/care/fulfilment/http'
import { getOwnPublishedSettlement } from '@/lib/care/fulfilment/service'

export const runtime = 'nodejs'

/**
 * 陪診員只看得到「自己的」「已發布」明細。
 * 未審核金額、他人金額、家庭支付金額、批次資料都不會出現在這裡。
 */
export async function GET(req: NextRequest) {
  const auth = requireStaff(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getOwnPublishedSettlement(auth.actor) })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
