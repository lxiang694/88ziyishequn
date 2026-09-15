import { NextRequest, NextResponse } from 'next/server'
import { authorize, failure, json } from '@/lib/myship/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(params.id)) return failure('批次編號格式錯誤')
  const { data, error } = await supabaseAdmin.from('myship_transfers').select('status').eq('batch_id', params.id)
  if (error) return failure('讀取批次失敗', 500)
  if (!data?.length) return failure('找不到批次', 404)
  return json({ total: data.length, confirmed: data.filter(t => t.status === 'confirmed').length, pending: data.filter(t => t.status === 'exported').length, released: data.filter(t => t.status === 'released').length })
}
