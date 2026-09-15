import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json, readBody } from '@/lib/myship/server'
import { writeAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  try {
    const body = await readBody(req)
    if (!Number.isSafeInteger(body.variant_id) || body.variant_id < 1 || typeof body.marketplace_id !== 'string') return failure('規格或賣場資料錯誤')
    if (body.marketplace_id === '') {
      const { error } = await supabaseAdmin.from('myship_variant_mappings').delete().eq('variant_id', body.variant_id)
      if (error) return failure('移除配對失敗', 500)
    } else {
      const { data } = await supabaseAdmin.from('myship_marketplaces').select('id').eq('id', body.marketplace_id).eq('enabled', true).single()
      if (!data) return failure('賣場不存在或未啟用')
      const { error } = await supabaseAdmin.from('myship_variant_mappings').upsert({ variant_id: body.variant_id, marketplace_id: body.marketplace_id })
      if (error) return failure('儲存配對失敗', 500)
    }
    await writeAuditLog(req, auth.admin, 'myship.mapping', `variant=${body.variant_id};market=${body.marketplace_id}`)
    return json({ success: true })
  } catch { return failure('配對資料格式錯誤') }
}
