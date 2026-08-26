import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import { publishCarePolicyVersion } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.policy)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const body = await req.json()
    if ((body ?? {}).action !== 'publish') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    await publishCarePolicyVersion(id, auth.actor)
    await auditClosure(req, auth.actor, 'care_policy.publish',
      { resource: 'care_policy_version', resource_id: id, to_status: 'published' })
    return NextResponse.json({ success: true })
  } catch (e) { return closureErrorResponse(e) }
}
