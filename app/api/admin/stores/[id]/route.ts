import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { validateStore } from '@/lib/stores'

export const dynamic = 'force-dynamic'
const idOf = (v: string) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null }

/** 這間門市有幾張還沒出貨的訂單（改名稱、地址前先知道會影響誰） */
async function pendingUsage(id: number) {
  const [shop, gb] = await Promise.all([
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', id).eq('order_status', '待確認'),
    supabaseAdmin.from('group_buy_orders').select('id', { count: 'exact', head: true }).eq('store_id', id).eq('status', '待出貨'),
  ])
  return { orders: shop.count || 0, groupBuyOrders: gb.error ? 0 : gb.count || 0 }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'orders.transfer')
  if (auth instanceof NextResponse) return auth
  const id = idOf(params.id)
  if (!id) return NextResponse.json({ success: false, error: '門市編號錯誤' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('stores_711')
    .select('id, store_code, store_name, county, district, address, is_active').eq('id', id).maybeSingle()
  if (error || !data) return NextResponse.json({ success: false, error: '找不到這間門市' }, { status: 404 })
  return NextResponse.json({ success: true, data, usage: await pendingUsage(id) }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * 修改門市：店號、名稱、地址、啟用狀態。
 *
 * sync_pending：同時更新「還沒出貨」的訂單上記錄的門市名稱與地址。
 * 訂單下單時會把當時的門市名稱、地址存一份；門市改名或搬家後兩邊不一致，
 * 賣貨便轉單會擋下來要人工核對。已出貨的訂單保留原樣，那是當時寄送的紀錄。
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'orders.transfer')
  if (auth instanceof NextResponse) return auth
  const id = idOf(params.id)
  if (!id) return NextResponse.json({ success: false, error: '門市編號錯誤' }, { status: 400 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  const checked = validateStore(body)
  if (!checked.ok) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })
  const s = checked.value

  const { data: before } = await supabaseAdmin.from('stores_711')
    .select('store_code, store_name, county, district, address, is_active').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ success: false, error: '找不到這間門市' }, { status: 404 })
  if (s.store_code !== before.store_code) {
    const { data: dup } = await supabaseAdmin.from('stores_711').select('id, store_name').eq('store_code', s.store_code).neq('id', id).maybeSingle()
    if (dup) return NextResponse.json({ success: false, error: `店號 ${s.store_code} 已經是「${dup.store_name}」，不能重複` }, { status: 409 })
  }

  const { error } = await supabaseAdmin.from('stores_711').update(s).eq('id', id)
  if (error) return NextResponse.json({ success: false, error: '儲存失敗，請稍後再試' }, { status: 500 })

  let synced = { orders: 0, groupBuyOrders: 0 }
  if (body?.sync_pending) {
    const [o, g] = await Promise.all([
      supabaseAdmin.from('orders')
        .update({ store_name: s.store_name, store_address: s.address, county: s.county, district: s.district })
        .eq('store_id', id).eq('order_status', '待確認').select('id'),
      supabaseAdmin.from('group_buy_orders')
        .update({ store_code: s.store_code, store_name: s.store_name, store_address: s.address })
        .eq('store_id', id).eq('status', '待出貨').select('id'),
    ])
    synced = { orders: o.data?.length || 0, groupBuyOrders: g.data?.length || 0 }
  }

  const changes = (Object.keys(s) as (keyof typeof s)[])
    .filter(k => String(before[k]) !== String(s[k]))
    .map(k => `${k}: ${before[k]} → ${s[k]}`)
  await writeAuditLog(req, auth.admin, 'store.update',
    `門市 #${id} ${s.store_name}：${changes.join('；') || '無變更'}${body?.sync_pending ? `；同步訂單 ${synced.orders}、團購 ${synced.groupBuyOrders}` : ''}`)
  return NextResponse.json({ success: true, synced })
}
