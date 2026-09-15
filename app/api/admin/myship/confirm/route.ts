import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, readBody } from '@/lib/myship/server'
import { writeAuditLog } from '@/lib/audit'
import { confirmError } from '@/lib/myship/confirmError'

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    if (typeof body.transfer_id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.transfer_id) || typeof body.external_order_no !== 'string' || !/^CM\d{13}$/.test(body.external_order_no) || body.verified !== true) return failure('請核對賣貨便成功訂單並填入CM開頭的訂單編號')
    const { error } = await supabaseAdmin.rpc('myship_confirm_transfer', { p_transfer_id: body.transfer_id, p_external_order_no: body.external_order_no, p_admin_id: auth.admin.id })
    if (error) return failure(confirmError(error), 409)
    await writeAuditLog(req, auth.admin, 'myship.confirm', `transfer=${body.transfer_id};external=${body.external_order_no}`)
    return json({ success: true })
  } catch { return failure('確認資料格式錯誤') }
}
