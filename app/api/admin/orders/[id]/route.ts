import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  // shipper can only see orders not full admin data
  const { data, error } = await supabaseAdmin
    .from('orders').select('*, order_items(*)').eq('id', params.id).single()
  if (error) return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
  return NextResponse.json({ success: true, data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  // Check permissions by role
  const canEditOrders = admin.permissions.includes('all') ||
    admin.permissions.includes('orders.status') ||
    admin.permissions.includes('orders.edit') ||
    admin.permissions.includes('orders.status.ship')

  if (!canEditOrders) {
    return NextResponse.json({ success: false, error: '無權限修改訂單' }, { status: 403 })
  }

  try {
    const { order_status, note } = await req.json()
    const orderId = parseInt(params.id)

    // Get current order status
    const { data: currentOrder } = await supabaseAdmin
      .from('orders').select('order_status').eq('id', orderId).single()

    if (!currentOrder) return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
    if (currentOrder.order_status === '已取消') {
      return NextResponse.json({ success: false, error: '此訂單已取消，無法再次修改' }, { status: 400 })
    }

    // shipper can only update shipping-related statuses
    if (admin.permissions.includes('orders.status.ship') && !admin.permissions.includes('all')) {
      const allowedStatuses = ['備貨中', '已出貨', '已到店']
      if (!allowedStatuses.includes(order_status)) {
        return NextResponse.json({ success: false, error: '出貨人員只可更新備貨中/已出貨/已到店狀態' }, { status: 403 })
      }
    }

    // If cancelling, use atomic RPC to restore stock
    if (order_status === '已取消' && currentOrder.order_status !== '已取消') {
      const { error: cancelError } = await supabaseAdmin.rpc('cancel_order_restore_stock', {
        p_order_id: orderId,
        p_admin_id: admin.id,
      })
      if (cancelError) {
        console.error('Cancel order RPC error:', cancelError)
        return NextResponse.json({ success: false, error: '取消失敗：' + cancelError.message }, { status: 500 })
      }
      // Update note if provided
      if (note !== undefined) {
        await supabaseAdmin.from('orders').update({ note }).eq('id', orderId)
      }
    } else {
      // Normal status update
      const updateData: any = { order_status, updated_at: new Date().toISOString() }
      if (note !== undefined) updateData.note = note
      const { error: updateError } = await supabaseAdmin
        .from('orders').update(updateData).eq('id', orderId)
      if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '訂單狀態已更新' })
  } catch (err) {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  // Only super admin can permanently delete orders
  if (!admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '只有超級管理員可刪除訂單' }, { status: 403 })
  }

  try {
    const orderId = parseInt(params.id)

    // Get order info before deletion (for response message + stock restore decision)
    const { data: currentOrder } = await supabaseAdmin
      .from('orders').select('order_status, order_no').eq('id', orderId).single()

    if (!currentOrder) {
      return NextResponse.json({ success: false, error: '訂單不存在' }, { status: 404 })
    }

    // If order is still active (not cancelled), restore stock first
    let stockRestored = false
    if (currentOrder.order_status !== '已取消') {
      const { error: cancelError } = await supabaseAdmin.rpc('cancel_order_restore_stock', {
        p_order_id: orderId,
        p_admin_id: admin.id,
      })
      if (cancelError) {
        return NextResponse.json(
          { success: false, error: '無法回補庫存：' + cancelError.message },
          { status: 500 }
        )
      }
      stockRestored = true
    }

    // Detach inventory_logs (keep history, just null the order link)
    // Without this, the FK constraint inventory_logs_related_order_id_fkey blocks deletion
    await supabaseAdmin
      .from('inventory_logs')
      .update({ related_order_id: null })
      .eq('related_order_id', orderId)

    // Delete order_items first (in case foreign key has no CASCADE)
    await supabaseAdmin.from('order_items').delete().eq('order_id', orderId)

    // Delete order
    const { error: deleteError } = await supabaseAdmin
      .from('orders').delete().eq('id', orderId)
    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `訂單 ${currentOrder.order_no} 已永久刪除${stockRestored ? '，庫存已回補' : ''}`,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: '刪除失敗' }, { status: 500 })
  }
}
