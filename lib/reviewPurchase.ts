import { supabaseAdmin } from './supabase'
import { isSafePhone } from './orderSecurity'

/**
 * 這位會員有沒有買過這個商品（未取消的訂單），有的話回傳最近一次買的規格。
 * 跟「我的訂單」同一套歸屬規則：user_id 為主，入會前用同一支手機下的訪客單也算。
 */
export async function findPurchase(userId: string, productId: number): Promise<{ variant_name: string | null } | null> {
  const { data: profile } = await supabaseAdmin.from('user_profiles').select('phone').eq('id', userId).maybeSingle()
  let query = supabaseAdmin.from('orders')
    .select('id, created_at, order_items!inner(product_id, variant_name_snapshot)')
    .eq('order_items.product_id', productId)
    .neq('order_status', '已取消')
    .order('created_at', { ascending: false })
    .limit(1)
  query = isSafePhone(profile?.phone)
    ? query.or(`user_id.eq.${userId},and(user_id.is.null,phone.eq.${profile!.phone})`)
    : query.eq('user_id', userId)
  const { data, error } = await query
  if (error || !data?.length) return null
  const item = (data[0] as any).order_items?.[0]
  return { variant_name: item?.variant_name_snapshot || null }
}
