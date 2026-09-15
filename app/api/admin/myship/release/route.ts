import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, readBody } from '@/lib/myship/server'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    if (typeof body.transfer_id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.transfer_id) || body.verified_not_created !== true || typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 200) return failure('請核對未成立訂單並填寫5至200字原因')
    const { error } = await supabaseAdmin.rpc('myship_release_transfer', { p_transfer_id: body.transfer_id, p_reason: body.reason, p_admin_id: auth.admin.id })
    if (error) return failure('此轉單已確認或已解除，請重新整理', 409)
    await writeAuditLog(req, auth.admin, 'myship.release', `transfer=${body.transfer_id}`)
    return json({ success: true })
  } catch { return failure('解除保留資料格式錯誤') }
}
