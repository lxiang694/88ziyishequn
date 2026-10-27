import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, readBody } from '@/lib/myship/server'
import { writeAuditLog } from '@/lib/audit'
import { recipientNameError } from '@/lib/recipientName'

/**
 * 修改訂單的取件人姓名（賣貨便轉單頁上，姓名不合規則時直接改）。
 * 只能改還沒出貨的訂單：一般訂單「待確認」、團購訂單「待出貨」。
 */
export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    const id = Number(body.order_id)
    const kind = body.kind === 'group_buy' ? 'group_buy' : 'shop'
    const name = typeof body.customer_name === 'string' ? body.customer_name.trim().replace(/\s+/g, ' ') : ''
    if (!Number.isSafeInteger(id) || id <= 0) return failure('訂單編號錯誤')
    const problem = recipientNameError(name)
    if (problem) return failure(problem)

    const table = kind === 'group_buy' ? 'group_buy_orders' : 'orders'
    const statusCol = kind === 'group_buy' ? 'status' : 'order_status'
    const pending = kind === 'group_buy' ? '待出貨' : '待確認'
    const { data: order } = await supabaseAdmin.from(table).select(`order_no, customer_name, ${statusCol}`).eq('id', id).maybeSingle()
    if (!order) return failure('找不到這張訂單', 404)
    const o = order as Record<string, any>
    if (o[statusCol] !== pending) return failure(`這張訂單已經不是「${pending}」，不能修改姓名`, 409)

    const { error } = await supabaseAdmin.from(table).update({ customer_name: name }).eq('id', id).eq(statusCol, pending)
    if (error) return failure('修改失敗，請稍後再試', 500)
    await writeAuditLog(req, auth.admin, 'order.recipient_name', `${o.order_no} 取件人姓名「${o.customer_name}」→「${name}」`)
    return json({ success: true })
  } catch { return failure('資料格式錯誤') }
}
