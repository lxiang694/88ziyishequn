import { NextRequest, NextResponse } from 'next/server'
import { isDeepStrictEqual } from 'node:util'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure } from '@/lib/myship/server'
import { snapshot, type TransferOrder, type ImportRow } from '@/lib/myship/domain'
import { buildWorkbook } from '@/lib/myship/workbook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(params.id)) return failure('批次編號錯誤')
  try {
    const { data, error } = await supabaseAdmin.from('myship_transfers').select('*').eq('batch_id', params.id).order('order_id')
    if (error) return failure('讀取批次失敗', 500)
    if (!data?.length) return failure('找不到批次', 404)
    // 部分已確認的批次不再提供整批重下載，以免再次匯入已成立的訂單。
    if (data.some(t => t.status !== 'exported')) return failure('此批次已有成功或解除保留的訂單，不可重新下載整批', 409)
    const { data: orders, error: orderError } = await supabaseAdmin.from('orders').select('*, order_items(*)').in('id', data.map(t => t.order_id))
    if (orderError) return failure('無法核對原訂單', 500)
    for (const t of data) {
      const order = orders?.find(o => o.id === t.order_id)
      if (!order || !isDeepStrictEqual(snapshot(order as TransferOrder), t.snapshot)) return failure('原訂單已變更，請人工核對此批次', 409)
    }
    const file = await buildWorkbook(data.map(t => t.import_row as ImportRow))
    return new NextResponse(Buffer.from(file), { headers: {
      'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      'Content-Disposition': `attachment; filename="myship-${params.id}.xlsm"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch { return failure('匯出檔案失敗，批次仍保留，請稍後重試', 500) }
}
