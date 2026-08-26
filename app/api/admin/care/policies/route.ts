import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure,
} from '@/lib/care/operations/http'
import { listCarePolicyVersions, createCarePolicyVersionDraft } from '@/lib/care/operations/service'
import { parseCreatePolicyVersion } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.policy)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await listCarePolicyVersions() })
  } catch (e) { return closureErrorResponse(e) }
}

export async function POST(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.policy)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if ((body ?? {}).action !== 'create_draft') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const input = parseCreatePolicyVersion(body)
    const r = await createCarePolicyVersionDraft(input, auth.actor)
    await auditClosure(req, auth.actor, 'care_policy.draft_create',
      { resource: 'care_policy_version', resource_id: r.policyVersionId, reason_code: input.policy_kind })
    return NextResponse.json({ success: true, data: r })
  } catch (e) { return closureErrorResponse(e) }
}
