import { NextRequest, NextResponse } from 'next/server'
import { authorize, failure, json } from '@/lib/myship/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 助手查詢一批的進度。
 *
 * 找不到這批時不再回 404，而是回「0 筆、missing: true」。
 *
 * 為什麼：助手是先在自己那邊記下「開始一批」，再請網站建立批次。
 * 建立那一步失敗（例如訂單剛好被改、網路斷掉），網站上就沒有這一批，
 * 但助手已經把它記成「需要核對」。以前查詢一律回 404「找不到批次」，
 * 「保留此批」「讀回上一批結果」都會失敗，「自動轉到賣貨便」又說上一批
 * 還沒結束 —— 助手永遠卡住，新訂單轉不了。
 *
 * 回 0 筆是安全的：匯入檔只能在批次建立後才下載得到，網站上沒有這一批，
 * 就代表沒有任何檔案送到賣貨便。助手讀回時看到「沒有待核對的訂單」，
 * 會把這一批標成結束，就能繼續轉其他訂單。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(params.id)) return failure('批次編號格式錯誤')
  const { data, error } = await supabaseAdmin.from('myship_transfers').select('status').eq('batch_id', params.id)
  if (error) return failure('讀取批次失敗', 500)
  if (!data?.length) return json({ total: 0, confirmed: 0, pending: 0, released: 0, missing: true })
  return json({ total: data.length, confirmed: data.filter(t => t.status === 'confirmed').length, pending: data.filter(t => t.status === 'exported').length, released: data.filter(t => t.status === 'released').length })
}
