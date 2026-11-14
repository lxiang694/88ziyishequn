import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, readBody } from '@/lib/myship/server'
import { writeAuditLog } from '@/lib/audit'
import { ITEM_NAME_MAX } from '@/lib/myship/domain'

/**
 * 修改訂單裡商品的品名、規格文字（賣貨便轉單頁上，商品明細超過 200 字時直接縮短）。
 *
 * 改的是這張訂單的快照（order_items.product_name_snapshot / variant_name_snapshot），
 * 不動商城的商品資料，其他訂單也不受影響。數量、金額不能改。
 * variant 沒傳就不改規格文字（相容舊的呼叫方式）。
 * 只能改還沒出貨（待確認）的訂單。
 */
export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    const id = Number(body.item_id)
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (!Number.isSafeInteger(id) || id <= 0) return failure('商品明細編號錯誤')
    if (!name) return failure('品名不可空白')
    if (Array.from(name).length > ITEM_NAME_MAX) return failure(`品名最多 ${ITEM_NAME_MAX} 個字`)
    const variant = typeof body.variant === 'string' ? body.variant.trim().replace(/\s+/g, ' ') : undefined
    if (variant !== undefined && !variant) return failure('規格不可空白')
    if (variant !== undefined && Array.from(variant).length > ITEM_NAME_MAX) return failure(`規格最多 ${ITEM_NAME_MAX} 個字`)

    const { data: item } = await supabaseAdmin.from('order_items')
      .select('id, product_name_snapshot, variant_name_snapshot, orders!inner(order_no, order_status)').eq('id', id).maybeSingle()
    if (!item) return failure('找不到這個商品明細', 404)
    const it = item as any
    const order = Array.isArray(it.orders) ? it.orders[0] : it.orders
    if (order?.order_status !== '待確認') return failure('這張訂單已經不是「待確認」，不能修改品名', 409)
    const patch: Record<string, string> = {}
    if (it.product_name_snapshot !== name) patch.product_name_snapshot = name
    if (variant !== undefined && it.variant_name_snapshot !== variant) patch.variant_name_snapshot = variant
    if (!Object.keys(patch).length) return json({ success: true })

    const { error } = await supabaseAdmin.from('order_items').update(patch).eq('id', id)
    if (error) return failure('修改失敗，請稍後再試', 500)
    const log = [
      patch.product_name_snapshot ? `品名「${it.product_name_snapshot}」→「${name}」` : '',
      patch.variant_name_snapshot ? `規格「${it.variant_name_snapshot}」→「${variant}」` : '',
    ].filter(Boolean).join('；')
    await writeAuditLog(req, auth.admin, 'order.item_name', `${order.order_no} ${log}`)
    return json({ success: true })
  } catch { return failure('資料格式錯誤') }
}
