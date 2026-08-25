import { NextRequest, NextResponse } from 'next/server'
import { requireOwnStaff, staffingErrorResponse, parseId } from '@/lib/care/staffing/http'
import { parseAvailabilityRule } from '@/lib/care/staffing/validation'
import {
  getOwnAvailability, setOwnAvailabilityRule,
  updateOwnAvailabilityRule, disableOwnAvailabilityRule,
} from '@/lib/care/staffing/service'
import { CareInputError } from '@/lib/care/staffing/domain'

export const runtime = 'nodejs'

/** 只回自己的時段 */
export async function GET(req: NextRequest) {
  const auth = requireOwnStaff(req)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getOwnAvailability(auth.actor) })
  } catch (e) {
    return staffingErrorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  const auth = requireOwnStaff(req)
  if (auth instanceof NextResponse) return auth
  const { actor } = auth
  try {
    const body = await req.json().catch(() => ({}))
    const action = String((body as any)?.action || 'create')

    if (action === 'create') {
      const r = await setOwnAvailabilityRule(parseAvailabilityRule(body), actor)
      return NextResponse.json({ success: true, data: { rule_id: r.ruleId } })
    }
    if (action === 'update') {
      const id = parseId(String((body as any)?.rule_id ?? ''))
      await updateOwnAvailabilityRule(id, parseAvailabilityRule(body), actor)
      return NextResponse.json({ success: true })
    }
    if (action === 'disable') {
      const id = parseId(String((body as any)?.rule_id ?? ''))
      await disableOwnAvailabilityRule(id, actor)
      return NextResponse.json({ success: true })
    }
    throw new CareInputError('不支援的操作')
  } catch (e) {
    return staffingErrorResponse(e)
  }
}
