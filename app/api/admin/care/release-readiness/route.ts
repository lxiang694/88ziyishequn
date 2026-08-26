import { NextRequest, NextResponse } from 'next/server'
import { requireClosurePermission, CLOSURE_PERMISSIONS, closureErrorResponse } from '@/lib/care/operations/http'
import { getCareReleaseReadiness } from '@/lib/care/operations/service'

export const runtime = 'nodejs'

/** 只有讀取；沒有任何「手動標記為已完成」的寫入路徑 */
export async function GET(req: NextRequest) {
  const auth = requireClosurePermission(req, CLOSURE_PERMISSIONS.releaseReadiness)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json({ success: true, data: await getCareReleaseReadiness() })
  } catch (e) { return closureErrorResponse(e) }
}
