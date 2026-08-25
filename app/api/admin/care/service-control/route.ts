import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_READ_PERMISSION, fulfilmentErrorResponse,
} from '@/lib/care/fulfilment/http'
import { getCareServiceControlOverview } from '@/lib/care/fulfilment/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_READ_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getCareServiceControlOverview() })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
