import { NextRequest, NextResponse } from 'next/server'
import { listQuotes } from '@/lib/care/repository'
import {
  CARE_ANY_PERMISSION, CARE_PERMISSIONS, auditCare, careErrorResponse,
  requireCarePermission,
} from '@/lib/care/http'
import { parseQuoteDraft } from '@/lib/care/validation'
import { createCareQuoteDraft } from '@/lib/care/service'
import { CareInputError, QUOTE_STATUSES } from '@/lib/care/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const raw = new URL(req.url).searchParams.get('status') || ''
    const status = (QUOTE_STATUSES as readonly string[]).includes(raw) ? raw : undefined
    const data = await listQuotes(status)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return careErrorResponse(e)
  }
}

/**
 * 建立報價草稿。
 * 總價與方案快照都由伺服器決定，client 傳 total_estimate / base_fee 無效。
 */
export async function POST(req: NextRequest) {
  const auth = requireCarePermission(req, CARE_PERMISSIONS.quote)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const body = await req.json().catch(() => ({}))
    const caseId = Number((body as any)?.care_case_id)
    if (!Number.isInteger(caseId) || caseId <= 0) throw new CareInputError('缺少案件識別碼', 'care_case_id')

    const input = parseQuoteDraft(body)
    const r = await createCareQuoteDraft(caseId, input, actor)
    await auditCare(req, actor, 'care_quote.draft_create',
      { resource: 'care_quote', resource_id: r.quoteId, to_status: 'draft', quote_version: r.version })
    return NextResponse.json({ success: true, data: { quote_id: r.quoteId, version: r.version, total_estimate: r.total } })
  } catch (e) {
    return careErrorResponse(e)
  }
}
