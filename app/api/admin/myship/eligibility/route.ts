import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json } from '@/lib/myship/server'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin.from('myship_transfers').select('id')
    .eq('marketplace_id', 'GM2601252733206').eq('status', 'confirmed').limit(1)
  if (error) return failure('無法確認已完成的轉單紀錄，請稍後重新整理', 503)
  return json({ pilot: !!data?.length })
}
