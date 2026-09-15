import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorize, failure, json } from '@/lib/myship/server'
import { isMarketplaceId } from '@/lib/myship/domain'

export const dynamic = 'force-dynamic'

/**
 * 這個賣場是否已經完成過至少一筆轉單。
 *
 * 助手用這個結果決定要不要放行批次：pilot 為 false 時一次只能選 1 筆
 * 試轉，成功後才開放批次。
 *
 * ⚠️ 必須**按賣場**計算。原本這裡寫死 GM2601252733206，於是新增第二個
 *    賣場時會直接繼承第一個賣場的「已驗收」狀態，跳過試轉直接批次 ——
 *    而新賣場的溫層、代收金額、運費設定都還沒有被任何一筆真實訂單驗證過。
 */
export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth

  const marketplaceId = new URL(req.url).searchParams.get('marketplace_id') || ''
  if (!isMarketplaceId(marketplaceId)) return failure('缺少有效的賣場代碼')

  const { data, error } = await supabaseAdmin.from('myship_transfers').select('id')
    .eq('marketplace_id', marketplaceId).eq('status', 'confirmed').limit(1)
  if (error) return failure('無法確認已完成的轉單紀錄，請稍後重新整理', 503)
  return json({ pilot: !!data?.length })
}
