import { NextRequest, NextResponse } from 'next/server'
import {
  requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse, auditClosure, parseId,
} from '@/lib/care/operations/http'
import { markCareDataLifecycleReviewed } from '@/lib/care/operations/service'
import { parseMarkLifecycleReviewed } from '@/lib/care/operations/validation'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.lifecycle)
  if (auth instanceof NextResponse) return auth
  try {
    const id = parseId(params.id)
    const body = await req.json()
    if ((body ?? {}).action !== 'mark_reviewed') {
      return NextResponse.json({ success: false, error: '不支援的操作' }, { status: 400 })
    }
    const { status, note } = parseMarkLifecycleReviewed(body)
    await markCareDataLifecycleReviewed(id, status, note, auth.actor)
    await auditClosure(req, auth.actor, 'care_data_lifecycle.mark_reviewed',
      { resource: 'care_data_lifecycle_review', resource_id: id, to_status: status })
    return NextResponse.json({ success: true })
  } catch (e) { return closureErrorResponse(e) }
}
