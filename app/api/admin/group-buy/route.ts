import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { writeAuditLog } from '@/lib/audit'
import { authorizeGroupBuy } from '@/lib/groupBuy/adminAuth'
import { parseCampaignInput } from '@/lib/groupBuy/adminInput'
import { addMonths, slugForStart } from '@/lib/groupBuy/domain'

export const dynamic = 'force-dynamic'
const missingTable = (code?: string) => code === '42P01' || code === 'PGRST205'

/** 檔期列表，附每檔的訂單數與營業額（不含已取消） */
export async function GET(req: NextRequest) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin.from('group_buy_campaigns')
    .select('id, slug, title, starts_at, ends_at, is_published, ship_711_enabled, ship_home_enabled')
    .order('starts_at', { ascending: false }).limit(200)
  if (error) {
    if (missingTable(error.code)) return NextResponse.json({ success: true, data: [], needsMigration: true })
    return NextResponse.json({ success: false, error: '讀取檔期失敗' }, { status: 500 })
  }
  const ids = (data || []).map(c => c.id)
  const totals = new Map<number, { orders: number; revenue: number }>()
  if (ids.length) {
    for (let from = 0; ; from += 1000) {
      const { data: orders } = await supabaseAdmin.from('group_buy_orders')
        .select('campaign_id, total_amount').in('campaign_id', ids).neq('status', '已取消').order('id').range(from, from + 999)
      for (const o of orders || []) {
        const t = totals.get(o.campaign_id) || { orders: 0, revenue: 0 }
        t.orders++; t.revenue += o.total_amount
        totals.set(o.campaign_id, t)
      }
      if (!orders || orders.length < 1000) break
    }
  }
  return NextResponse.json({ success: true, data: (data || []).map(c => ({ ...c, ...(totals.get(c.id) || { orders: 0, revenue: 0 }) })) })
}

/**
 * 新增檔期。body.copy_from = 檔期 id 時，複製那一檔（含上架中的商品）到下個月：
 * 開團、截單時間各往後一個月，設成草稿，網址代稱用新的開團月份。
 */
export async function POST(req: NextRequest) {
  const auth = authorizeGroupBuy(req)
  if (auth instanceof NextResponse) return auth
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }

  if (body?.copy_from) {
    const { data: src } = await supabaseAdmin.from('group_buy_campaigns').select('*').eq('id', Number(body.copy_from)).maybeSingle()
    if (!src) return NextResponse.json({ success: false, error: '找不到要複製的檔期' }, { status: 404 })
    const { data: slugs } = await supabaseAdmin.from('group_buy_campaigns').select('slug')
    const starts_at = addMonths(src.starts_at), ends_at = addMonths(src.ends_at)
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = src
    const { data: created, error } = await supabaseAdmin.from('group_buy_campaigns').insert({
      ...rest, starts_at, ends_at, is_published: false,
      slug: slugForStart(starts_at, (slugs || []).map(s => s.slug)),
      title: src.title.replace(/\d{1,2}\s*月/, `${new Date(new Date(starts_at).getTime() + 8 * 3600_000).getUTCMonth() + 1} 月`),
    }).select('id').single()
    if (error || !created) return NextResponse.json({ success: false, error: '複製失敗' }, { status: 500 })
    const { data: items } = await supabaseAdmin.from('group_buy_items')
      .select('name, spec, description, image_url, price, original_price, per_person_limit, total_quota, sort_order')
      .eq('campaign_id', src.id).eq('is_active', true)
    if (items?.length) {
      await supabaseAdmin.from('group_buy_items').insert(items.map(i => ({ ...i, campaign_id: created.id })))
    }
    await writeAuditLog(req, auth.admin, 'group_buy.copy', `${src.slug} → ${created.id}`)
    return NextResponse.json({ success: true, data: { id: created.id } })
  }

  const { value, error: problem } = parseCampaignInput(body)
  if (!value) return NextResponse.json({ success: false, error: problem }, { status: 400 })
  const { data: created, error } = await supabaseAdmin.from('group_buy_campaigns').insert(value).select('id').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ success: false, error: '網址代稱已被其他檔期使用' }, { status: 400 })
    if (missingTable(error.code)) return NextResponse.json({ success: false, error: '請先執行 migrations/group_buy_schema.sql' }, { status: 400 })
    return NextResponse.json({ success: false, error: '新增檔期失敗' }, { status: 500 })
  }
  await writeAuditLog(req, auth.admin, 'group_buy.create', value.slug)
  return NextResponse.json({ success: true, data: { id: created.id } })
}
