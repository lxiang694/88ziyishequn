import { NextRequest, NextResponse } from 'next/server'
import { listCases } from '@/lib/care/repository'
import { CARE_ANY_PERMISSION, careErrorResponse, requireCarePermission } from '@/lib/care/http'
import { CASE_STATUSES } from '@/lib/care/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (CASE_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    const data = await listCases(status)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return careErrorResponse(e)
  }
}
