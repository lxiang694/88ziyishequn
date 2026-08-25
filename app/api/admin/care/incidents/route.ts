import { NextRequest, NextResponse } from 'next/server'
import {
  requireFulfilmentPermission, FULFILMENT_READ_PERMISSION, fulfilmentErrorResponse,
} from '@/lib/care/fulfilment/http'
import { listIncidents } from '@/lib/care/fulfilment/repository'
import { INCIDENT_STATUSES } from '@/lib/care/fulfilment/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireFulfilmentPermission(req, FULFILMENT_READ_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (INCIDENT_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    return NextResponse.json({ success: true, data: await listIncidents(status) })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
