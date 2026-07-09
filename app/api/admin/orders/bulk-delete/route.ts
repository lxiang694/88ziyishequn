import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  // Only super admin can permanently delete orders
  if (!admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '只有超級管理員可刪除訂單' }, { status: 403 })
  }

  let ids: number[]
  try {
    const body = await req.json()
    ids = Array.isArray(body.ids) ? body.ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id)) : []
  } catch {
    return NextResponse.json({ success: false, error: '請求格式錯誤' }, { status: 400 })
  }

  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: '未選擇任何訂單' }, { status: 400 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ success: false, error: '單次最多刪除 500 筆訂單' }, { status: 400 })
  }

  async function deleteOne(orderId: number): Promise<{ id: number; error?: string }> {
    try {
      const { data: currentOrder } = await supabaseAdmin
        .from('orders').select('order_status, order_no').eq('id', orderId).single()

      if (!currentOrder) return { id: orderId, error: '訂單不存在' }

      if (currentOrder.order_status !== '已取消') {
        const { error: cancelError } = await supabaseAdmin.rpc('cancel_order_restore_stock', {
          p_order_id: orderId,
          p_admin_id: admin.id,
        })
        if (cancelError) return { id: orderId, error: '無法回補庫存：' + cancelError.message }
      }

      await supabaseAdmin
        .from('inventory_logs')
        .update({ related_order_id: null })
        .eq('related_order_id', orderId)

      await supabaseAdmin.from('order_items').delete().eq('order_id', orderId)

      const { error: deleteError } = await supabaseAdmin
        .from('orders').delete().eq('id', orderId)
      if (deleteError) return { id: orderId, error: deleteError.message }

      return { id: orderId }
    } catch (err: any) {
      return { id: orderId, error: err?.message || '刪除失敗' }
    }
  }

  const deleted: number[] = []
  const failed: { id: number; error: string }[] = []

  const BATCH_SIZE = 10
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(deleteOne))
    for (const r of results) {
      if (r.error) failed.push({ id: r.id, error: r.error })
      else deleted.push(r.id)
    }
  }

  return NextResponse.json({
    success: failed.length === 0,
    deleted,
    failed,
    message: `已刪除 ${deleted.length} 筆訂單${failed.length > 0 ? `，${failed.length} 筆失敗` : ''}`,
  })
}
