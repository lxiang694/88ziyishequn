import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/adminMiddleware'

export const GROUP_BUY_PERMISSION = 'group_buy.manage'

/** 團購後台：需要 group_buy.manage 權限；寫入時要求從本站後台送出 */
export function authorizeGroupBuy(req: NextRequest) {
  const auth = requirePermission(req, GROUP_BUY_PERMISSION)
  if (auth instanceof NextResponse) return auth
  if (req.method !== 'GET') {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin) {
      return NextResponse.json({ success: false, error: '請從本站後台操作' }, { status: 403 })
    }
  }
  return auth
}
