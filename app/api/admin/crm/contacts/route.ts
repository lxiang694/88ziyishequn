import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { normalizePhone } from '@/lib/crm'

const LIST_KEYS = ['core', 'due', 'dormant', 'lost', 'one_time', 'all']

/** 後台：記一筆「已聯繫」（之後這位客人再下單就算挽回成功） */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('orders.view') && admin.role_key !== 'customer_service') {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: '格式錯誤' }, { status: 400 }) }
  const phone = normalizePhone(body?.phone)
  if (!phone) return NextResponse.json({ success: false, error: '手機格式錯誤' }, { status: 400 })
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) || null : null
  const { error } = await supabaseAdmin.from('customer_contacts').insert({
    phone, note, list_key: LIST_KEYS.includes(body?.list_key) ? body.list_key : 'all',
    admin_id: admin.id, admin_name: admin.name,
  })
  if (error) return NextResponse.json({ success: false, error: '尚未啟用聯繫紀錄：請先執行 migrations/customer_contacts.sql' }, { status: 503 })
  return NextResponse.json({ success: true })
}
