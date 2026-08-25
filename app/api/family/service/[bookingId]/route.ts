import { NextRequest, NextResponse } from 'next/server'
import { requireFamilyUser, fulfilmentErrorResponse, parseId } from '@/lib/care/fulfilment/http'
import { getAuthorizedFamilyView } from '@/lib/care/fulfilment/service'

export const runtime = 'nodejs'

/**
 * 家屬端唯一的讀取入口。
 *
 * 授權模型：必須是已登入的會員，且該筆服務有一列未撤回的授權。
 * 付款人、預約人、聯絡人都不會因為身分自動取得閱覽權。
 *
 * 沒有授權時一律回 404（不是 403）——避免用 id 探測某筆服務是否存在。
 */
export async function GET(req: NextRequest, { params }: { params: { bookingId: string } }) {
  const auth = await requireFamilyUser(req)
  if (auth instanceof NextResponse) return auth
  try {
    const view = await getAuthorizedFamilyView(parseId(params.bookingId), auth.userId)
    if (!view) return NextResponse.json({ success: false, error: '找不到這筆服務' }, { status: 404 })
    return NextResponse.json({ success: true, data: view })
  } catch (e) {
    return fulfilmentErrorResponse(e)
  }
}
