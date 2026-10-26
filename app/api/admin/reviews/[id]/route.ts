import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { refreshStorefront } from '@/lib/storefrontCache'

const idOf = (v: string) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null }

/** 後台：隱藏／重新顯示評價、寫或刪除賣家回覆 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'products.all')
  if (auth instanceof NextResponse) return auth
  const id = idOf(params.id)
  if (!id) return NextResponse.json({ success: false, error: '評價編號錯誤' }, { status: 400 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body?.status !== undefined) {
    if (body.status !== 'published' && body.status !== 'hidden') return NextResponse.json({ success: false, error: '狀態錯誤' }, { status: 400 })
    patch.status = body.status
  }
  if (body?.reply !== undefined) {
    const reply = typeof body.reply === 'string' ? body.reply.trim() : ''
    if (Array.from(reply).length > 500) return NextResponse.json({ success: false, error: '回覆最多 500 字' }, { status: 400 })
    patch.admin_reply = reply || null
    patch.admin_reply_at = reply ? new Date().toISOString() : null
  }
  if (!Object.keys(patch).length) return NextResponse.json({ success: false, error: '沒有要更新的內容' }, { status: 400 })

  const { error } = await supabaseAdmin.from('product_reviews').update(patch).eq('id', id)
  if (error) return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  await writeAuditLog(req, auth.admin, 'review.update', `評價 #${id}：${Object.keys(patch).join(', ')}`)
  refreshStorefront()
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requirePermission(req, 'products.all')
  if (auth instanceof NextResponse) return auth
  const id = idOf(params.id)
  if (!id) return NextResponse.json({ success: false, error: '評價編號錯誤' }, { status: 400 })
  const { error } = await supabaseAdmin.from('product_reviews').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, error: '刪除失敗' }, { status: 500 })
  await writeAuditLog(req, auth.admin, 'review.delete', `評價 #${id}`)
  refreshStorefront()
  return NextResponse.json({ success: true })
}
