import { NextRequest, NextResponse } from 'next/server'
import { loadShipGroups } from '@/lib/shipPackagesRepo'

export const dynamic = 'force-dynamic'

/**
 * GET /api/shipping/packages?v=12,34
 * 結帳頁用：購物車裡的規格各屬於哪一包、是現貨還是預購。
 * 只回代號與現貨／預購，不含賣場代碼。
 */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('v') || '').split(',').map(Number).filter(n => Number.isSafeInteger(n) && n > 0).slice(0, 100)
  const data = await loadShipGroups(ids).catch(() => ({}))
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } })
}
