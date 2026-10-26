import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { safeSearchTerm, validateStore } from '@/lib/stores'

export const dynamic = 'force-dynamic'
const PAGE = 30

/** 後台：搜尋門市（店號、店名、地址），可依縣市、啟用狀態篩選 */
export async function GET(req: NextRequest) {
  const auth = requirePermission(req, 'orders.transfer')
  if (auth instanceof NextResponse) return auth
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page')) || 1)
  let query = supabaseAdmin.from('stores_711')
    .select('id, store_code, store_name, county, district, address, is_active', { count: 'exact' })
    .order('is_active', { ascending: true })      // 停用的排前面，比較容易發現
    .order('county').order('district').order('store_name')
    .range((page - 1) * PAGE, page * PAGE - 1)
  const q = safeSearchTerm(sp.get('q'))
  if (q) query = /^\d{3,6}$/.test(q)
    ? query.like('store_code', `${q}%`)
    : query.or(`store_name.ilike.%${q}%,address.ilike.%${q}%`)
  const county = safeSearchTerm(sp.get('county'))
  if (county) query = query.eq('county', county)
  const status = sp.get('status')
  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)
  const { data, error, count } = await query
  if (error) return NextResponse.json({ success: false, error: '讀取門市失敗' }, { status: 500 })
  return NextResponse.json({ success: true, data: data || [], total: count || 0, pageSize: PAGE }, { headers: { 'Cache-Control': 'no-store' } })
}

/** 後台：新增門市（7-11 新開的店） */
export async function POST(req: NextRequest) {
  const auth = requirePermission(req, 'orders.transfer')
  if (auth instanceof NextResponse) return auth
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  const checked = validateStore(body)
  if (!checked.ok) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })
  const s = checked.value

  const { data: dup } = await supabaseAdmin.from('stores_711').select('id, store_name').eq('store_code', s.store_code).maybeSingle()
  if (dup) return NextResponse.json({ success: false, error: `店號 ${s.store_code} 已經是「${dup.store_name}」` }, { status: 409 })

  const { data, error } = await supabaseAdmin.from('stores_711').insert(s).select('id').single()
  if (error) return NextResponse.json({ success: false, error: '新增門市失敗' }, { status: 500 })
  await writeAuditLog(req, auth.admin, 'store.create', `新增門市 ${s.store_name}（${s.store_code}）`)
  return NextResponse.json({ success: true, id: data.id })
}
