import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { writeAuditLog } from '@/lib/audit'
import { authorizeGroupBuy } from '@/lib/groupBuy/adminAuth'
import { ORDER_STATUSES } from '@/lib/groupBuy/domain'

/** 改訂單狀態或內部備註。取消後，限量名額自動釋出（統計不含已取消） */
export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body?.status !== undefined) {
    if (!(ORDER_STATUSES as readonly string[]).includes(body.status)) return NextResponse.json({ success: false, error: '狀態不正確' }, { status: 400 })
    patch.status = body.status
  }
  if (body?.admin_note !== undefined) patch.admin_note = String(body.admin_note || '').slice(0, 500)

  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0).slice(0, 500) : [Number(params.orderId)]
  if (!ids.length) return NextResponse.json({ success: false, error: '請選擇訂單' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('group_buy_orders').update(patch).in('id', ids)
    .select('order_no, campaign_id')
  if (error) return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  await writeAuditLog(req, auth.admin, 'group_buy.order_update',
    `${(data || []).map(o => o.order_no).join('、')}${patch.status ? ` → ${patch.status}` : ''}`)
  if (patch.status === '已取消') {
    const { data: c } = await supabaseAdmin.from('group_buy_campaigns').select('slug').eq('id', data?.[0]?.campaign_id ?? 0).maybeSingle()
    try { if (c) revalidatePath(`/group-buy/${c.slug}`) } catch {}
  }
  return NextResponse.json({ success: true, updated: data?.length || 0 })
}
