import { NextRequest, NextResponse } from 'next/server'
import { requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse } from '@/lib/care/operations/http'
import { getCareInsights } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.insights)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getCareInsights() })
  } catch (e) { return closureErrorResponse(e) }
}
