import { NextRequest, NextResponse } from 'next/server'
import { listIntakes } from '@/lib/care/repository'
import { CARE_ANY_PERMISSION, careErrorResponse, requireCarePermission } from '@/lib/care/http'
import { INTAKE_STATUSES } from '@/lib/care/domain'

export const runtime = 'nodejs'

/** 初評清單。刻意不回傳 limited_support_note 與聯絡電話。 */
export async function GET(req: NextRequest) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth

  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (INTAKE_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    const data = await listIntakes(status)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return careErrorResponse(e)
  }
}
