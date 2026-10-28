import { supabaseAdmin } from './supabase'
import { generateCode, normalizeCode, referralOutcome, type ReferredOrder } from './referral'

/**
 * 推薦的資料庫操作（伺服器端）。referrals.sql 還沒執行時一律安靜失敗，
 * 不能因為推薦功能壞掉而讓下單、註冊失敗。
 */

/** 會員的推薦碼；第一次用時產生。資料表還沒建回 null */
export async function getOrCreateCode(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('referral_codes').select('code').eq('user_id', userId).maybeSingle()
  if (error) return null
  if (data?.code) return data.code
  for (let i = 0; i < 6; i++) {
    const code = generateCode()
    const { error: insErr } = await supabaseAdmin.from('referral_codes').insert({ user_id: userId, code })
    if (!insErr) return code
    // 同時開了兩個分頁：另一邊已經建好，直接讀
    const { data: again } = await supabaseAdmin.from('referral_codes').select('code').eq('user_id', userId).maybeSingle()
    if (again?.code) return again.code
  }
  return null
}

/** 推薦碼是誰的（含手機，用來擋自己推薦自己） */
export async function codeOwner(code: string): Promise<{ user_id: string; phone: string | null } | null> {
  const { data } = await supabaseAdmin.from('referral_codes').select('user_id').eq('code', code).maybeSingle()
  if (!data) return null
  const { data: profile } = await supabaseAdmin.from('user_profiles').select('phone').eq('id', data.user_id).maybeSingle()
  return { user_id: data.user_id, phone: profile?.phone || null }
}

/**
 * 下單成功後記上推薦碼。自己的推薦碼、不存在的推薦碼都不記；
 * 失敗不影響訂單（只記 log）。
 */
export async function attachReferral(table: 'orders' | 'group_buy_orders', orderNo: string, rawCode: unknown, buyer: { phone: string; userId?: string | null }) {
  const code = normalizeCode(rawCode)
  if (!code) return
  try {
    const owner = await codeOwner(code)
    if (!owner || owner.user_id === buyer.userId || (owner.phone && owner.phone === buyer.phone)) return
    const { error } = await supabaseAdmin.from(table).update({ referral_code: code }).eq('order_no', orderNo).is('referral_code', null)
    if (error) console.error('[referral] attach failed', table, error.code)
  } catch (e) {
    console.error('[referral] attach failed', e)
  }
}

/** 推薦訂單（一般＋團購，未取消），以及這些客人的第一張訂單，算出各推薦碼成效 */
export async function referralResults(filter: { code?: string; since?: string } = {}) {
  const pick = (table: 'orders' | 'group_buy_orders', statusCol: string) => {
    let q = supabaseAdmin.from(table).select('phone, order_no, created_at, total_amount, referral_code, customer_name')
      .not('referral_code', 'is', null).neq(statusCol, '已取消').order('created_at', { ascending: false }).limit(2000)
    if (filter.code) q = q.eq('referral_code', filter.code)
    if (filter.since) q = q.gte('created_at', filter.since)
    return q
  }
  const [shop, gb] = await Promise.all([pick('orders', 'order_status'), pick('group_buy_orders', 'status')])
  if (shop.error) return { ready: false, orders: [] as (ReferredOrder & { customer_name: string; kind: string })[], outcome: new Map() }
  const orders = [
    ...(shop.data || []).map((o: any) => ({ ...o, total: o.total_amount, kind: 'shop' })),
    ...((gb.error ? [] : gb.data) || []).map((o: any) => ({ ...o, total: o.total_amount, kind: 'group_buy' })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)) as (ReferredOrder & { customer_name: string; kind: string })[]

  // 這些客人的第一張訂單
  const phones = [...new Set(orders.map(o => o.phone))]
  const first = new Map<string, { order_no: string; at: string }>()
  for (let i = 0; i < phones.length; i += 200) {
    const chunk = phones.slice(i, i + 200)
    const [a, b] = await Promise.all([
      supabaseAdmin.from('orders').select('phone, order_no, created_at').in('phone', chunk).neq('order_status', '已取消'),
      supabaseAdmin.from('group_buy_orders').select('phone, order_no, created_at').in('phone', chunk).neq('status', '已取消'),
    ])
    for (const r of [...(a.data || []), ...((b.error ? [] : b.data) || [])] as any[]) {
      const cur = first.get(r.phone)
      if (!cur || r.created_at < cur.at) first.set(r.phone, { order_no: r.order_no, at: r.created_at })
    }
  }
  const firstOrderByPhone = new Map([...first].map(([p, v]) => [p, v.order_no]))
  return { ready: true, orders, outcome: referralOutcome(orders, firstOrderByPhone), firstOrderByPhone }
}
