import { NextRequest, NextResponse } from 'next/server'
import { getQuote, getQuoteItems } from '@/lib/care/repository'
import {
  CARE_ANY_PERMISSION, CARE_PERMISSIONS, auditCare, careErrorResponse,
  parseId, requireCarePermission,
} from '@/lib/care/http'
import { parseCancelCase, parseConfirmQuote, parseQuoteDraft } from '@/lib/care/validation'
import {
  cancelCareQuote, confirmCareQuote, expireCareQuote, sendCareQuote, updateCareQuoteDraft,
} from '@/lib/care/service'
import { CareInputError } from '@/lib/care/domain'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCarePermission(req, CARE_ANY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const quote = await getQuote(id)
    if (!quote) return NextResponse.json({ success: false, error: '找不到這份報價' }, { status: 404 })
    const items = await getQuoteItems(id)
    return NextResponse.json({ success: true, data: { quote, items } })
  } catch (e) {
    return careErrorResponse(e)
  }
}

/** 固定 use case；已確認／已過期的報價不會被無聲改寫（Service + DB trigger 雙重防護） */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireCarePermission(req, CARE_PERMISSIONS.quote)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth

  try {
    const id = parseId(params.id)
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || '')

    switch (action) {
      case 'update_draft': {
        const input = parseQuoteDraft(body)
        const r = await updateCareQuoteDraft(id, input, actor)
        await auditCare(req, actor, 'care_quote.update_draft',
          { resource: 'care_quote', resource_id: id, to_status: 'draft' })
        return NextResponse.json({ success: true, data: { total_estimate: r.total } })
      }
      case 'send': {
        const r = await sendCareQuote(id, actor)
        await auditCare(req, actor, 'care_quote.send',
          { resource: 'care_quote', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'confirm': {
        const { confirmed_by_label } = parseConfirmQuote(body)
        const r = await confirmCareQuote(id, confirmed_by_label, actor)
        await auditCare(req, actor, 'care_quote.confirm',
          { resource: 'care_quote', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'expire': {
        const r = await expireCareQuote(id, actor)
        await auditCare(req, actor, 'care_quote.expire',
          { resource: 'care_quote', resource_id: id, from_status: r.from, to_status: r.to })
        return NextResponse.json({ success: true })
      }
      case 'cancel': {
        const { reason_code } = parseCancelCase(body)
        const r = await cancelCareQuote(id, reason_code, actor)
        await auditCare(req, actor, 'care_quote.cancel',
          { resource: 'care_quote', resource_id: id, from_status: r.from, to_status: r.to, reason_code })
        return NextResponse.json({ success: true })
      }
      default:
        throw new CareInputError('不支援的操作')
    }
  } catch (e) {
    return careErrorResponse(e)
  }
}
