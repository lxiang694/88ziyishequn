import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { writeAuditLog } from '@/lib/audit'
import { authorizeGroupBuy } from '@/lib/groupBuy/adminAuth'
import { parseCampaignInput, parseItemsInput } from '@/lib/groupBuy/adminInput'
import { soldByItem } from '@/lib/groupBuy/repo'

export const dynamic = 'force-dynamic'
type Ctx = { params: { id: string } }

function refreshPages(slugs: string[]) {
  try {
    revalidatePath('/group-buy')
    for (const s of slugs) revalidatePath(`/group-buy/${s}`)
  } catch {}
}

/** 檔期與全部商品（含已下架），附各商品已售件數 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  const id = Number(params.id)
  const { data: campaign } = await supabaseAdmin.from('group_buy_campaigns').select('*').eq('id', id).maybeSingle()
  if (!campaign) return NextResponse.json({ success: false, error: '找不到檔期' }, { status: 404 })
  const { data: items } = await supabaseAdmin.from('group_buy_items').select('*').eq('campaign_id', id).order('sort_order').order('id')
  const sold = await soldByItem((items || []).map(i => i.id))
  return NextResponse.json({ success: true, data: { campaign, items: (items || []).map(i => ({ ...i, sold: sold.get(i.id) || 0 })) } })
}

/**
 * 儲存檔期與商品。商品清單整份送來：
 *   • 有 id 的更新，沒 id 的新增
 *   • 清單裡沒有的：已經有人訂過的改成下架（訂單明細還連著它），沒人訂過的直接刪除
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  const id = Number(params.id)
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }

  const { value: campaign, error: cErr } = parseCampaignInput(body?.campaign)
  if (!campaign) return NextResponse.json({ success: false, error: cErr }, { status: 400 })
  const { value: items, error: iErr } = parseItemsInput(body?.items)
  if (!items) return NextResponse.json({ success: false, error: iErr }, { status: 400 })
  if (campaign.is_published && !items.some(i => i.is_active)) {
    return NextResponse.json({ success: false, error: '發布前至少要有一樣上架中的商品' }, { status: 400 })
  }

  const { data: before } = await supabaseAdmin.from('group_buy_campaigns').select('slug').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ success: false, error: '找不到檔期' }, { status: 404 })

  const { error: upErr } = await supabaseAdmin.from('group_buy_campaigns')
    .update({ ...campaign, updated_at: new Date().toISOString() }).eq('id', id)
  if (upErr) {
    if (upErr.code === '23505') return NextResponse.json({ success: false, error: '網址代稱已被其他檔期使用' }, { status: 400 })
    return NextResponse.json({ success: false, error: '儲存檔期失敗' }, { status: 500 })
  }

  const { data: existing } = await supabaseAdmin.from('group_buy_items').select('id').eq('campaign_id', id)
  const existingIds = new Set((existing || []).map(i => i.id))
  const keep = new Set<number>()
  for (const it of items) {
    const { id: itemId, ...fields } = it
    if (itemId && existingIds.has(itemId)) {
      keep.add(itemId)
      const { error } = await supabaseAdmin.from('group_buy_items').update(fields).eq('id', itemId).eq('campaign_id', id)
      if (error) return NextResponse.json({ success: false, error: `儲存「${it.name}」失敗` }, { status: 500 })
    } else {
      const { error } = await supabaseAdmin.from('group_buy_items').insert({ ...fields, campaign_id: id })
      if (error) return NextResponse.json({ success: false, error: `新增「${it.name}」失敗` }, { status: 500 })
    }
  }
  const removed = [...existingIds].filter(x => !keep.has(x))
  if (removed.length) {
    const sold = await soldByItem(removed)
    const { data: ordered } = await supabaseAdmin.from('group_buy_order_items').select('item_id').in('item_id', removed)
    const hasOrders = new Set([...(ordered || []).map(o => o.item_id), ...sold.keys()])
    const toHide = removed.filter(x => hasOrders.has(x))
    const toDelete = removed.filter(x => !hasOrders.has(x))
    if (toHide.length) await supabaseAdmin.from('group_buy_items').update({ is_active: false }).in('id', toHide)
    if (toDelete.length) await supabaseAdmin.from('group_buy_items').delete().in('id', toDelete)
  }

  await writeAuditLog(req, auth.admin, 'group_buy.update', `${campaign.slug}（${items.length} 樣商品，${campaign.is_published ? '已發布' : '草稿'}）`)
  refreshPages([before.slug, campaign.slug])
  return NextResponse.json({ success: true })
}

/** 刪除檔期：只有還沒有任何訂單的才能刪 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  const id = Number(params.id)
  const { count } = await supabaseAdmin.from('group_buy_orders').select('id', { count: 'exact', head: true }).eq('campaign_id', id)
  if (count) return NextResponse.json({ success: false, error: '這一檔已經有訂單，不能刪除；可以改成草稿讓前台看不到' }, { status: 400 })
  const { data: c } = await supabaseAdmin.from('group_buy_campaigns').delete().eq('id', id).select('slug').maybeSingle()
  if (!c) return NextResponse.json({ success: false, error: '找不到檔期' }, { status: 404 })
  await writeAuditLog(req, auth.admin, 'group_buy.delete', c.slug)
  refreshPages([c.slug])
  return NextResponse.json({ success: true })
}
