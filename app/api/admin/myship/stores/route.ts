import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, readBody } from '@/lib/myship/server'
import { writeAuditLog } from '@/lib/audit'

/**
 * 重新啟用門市。
 *
 * 門市資料（stores_711）裡被標成停用、但其實還在營業的門市，訂單會卡在
 * 賣貨便轉單出不去。後台確認門市正常後，按一下就能恢復，不必進資料庫改。
 */
export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    const id = Number(body.store_id)
    if (!Number.isSafeInteger(id) || id <= 0 || body.action !== 'activate') return failure('門市資料格式錯誤')
    const { data, error } = await supabaseAdmin.from('stores_711').update({ is_active: true }).eq('id', id).select('id, store_name').maybeSingle()
    if (error) return failure('啟用門市失敗，請稍後再試', 500)
    if (!data) return failure('找不到這間門市', 404)
    await writeAuditLog(req, auth.admin, 'myship.store_activate', `門市 ${data.store_name}（${data.id}）重新啟用`)
    return json({ success: true })
  } catch { return failure('門市資料格式錯誤') }
}
