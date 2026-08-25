import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_ANY_PERMISSION, fulfilmentErrorResponse,
} from '@/lib/care/fulfilment/http'
import { listRecords } from '@/lib/care/fulfilment/repository'
import { RECORD_STATUSES } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (RECORD_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    return NextResponse.json({ success: true, data: await listRecords(status) })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
