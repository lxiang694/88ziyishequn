import { NextRequest, NextResponse } from 'next/server'
import { requireClosurePermission, OPERATIONS_READ_PERMISSION, closureErrorResponse } from '@/lib/care/operations/http'
import { getCareOperationsQueue } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, OPERATIONS_READ_PERMISSION)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getCareOperationsQueue() })
  } catch (e) { return closureErrorResponse(e) }
}
