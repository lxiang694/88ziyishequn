import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { sanitizeOrderSearch } from '@/lib/adminOrderSearch'
import { parseQuickOrder } from '@/lib/quickOrder/parse'
import {
  matchVariants, matchStores, isConfident, stripStoreNoise,
  MIN_AUTO_SCORE,
  type ProductRow, type StoreRow,
} from '@/lib/quickOrder/match'
import { QUICK_ORDER_PERMISSION } from '@/lib/quickOrder/domain'

/**
 * POST /api/admin/quick-order/parse
 *
 * 把貼上的一段文字變成「訂單草稿」。
 *
 * ⚠️ 這支 API **不會建立任何訂單**。它只回傳猜測結果與備選項，
 *    由人在畫面上確認後再呼叫 POST /api/admin/quick-order。
 *
 *    分成兩支的理由：比對錯誤的代價是寄錯東西給真實客戶。
 *    貼上就直接成立訂單，第一次貼錯格式就會產生一筆爛資料，
 *    而且庫存已經被扣掉了。
 */
export async function POST(req: NextRequest) {
  const auth = requirePermission(req, QUICK_ORDER_PERMISSION)
  if (auth instanceof NextResponse) return auth

  let text = ''
  try {
    const body = await req.json()
    text = typeof body?.text === 'string' ? body.text : ''
  } catch {
    return NextResponse.json({ success: false, error: '請求格式錯誤' }, { status: 400 })
  }

  if (!text.trim()) {
    return NextResponse.json({ success: false, error: '請先貼上訂單資訊' }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ success: false, error: '內容過長' }, { status: 400 })
  }

  const parsed = parseQuickOrder(text)

  // ── 商品 ────────────────────────────────────────────────
  // 上架商品數量不多（百位數），一次load完在記憶體比對，
  // 比為每個品項各發一次模糊查詢單純也快。
  const { data: products, error: pErr } = await supabaseAdmin
    .from('products')
    .select('id, product_name, cover_image_url, is_published, product_variants(id,variant_name,sale_price,stock_qty,sku_code,is_active)')
    .eq('is_published', true)
    .limit(500)

  if (pErr) {
    console.error('[quick-order/parse] load products failed', pErr)
    return NextResponse.json({ success: false, error: '讀取商品失敗' }, { status: 500 })
  }

  const items = parsed.items.map(item => {
    const candidates = matchVariants(item.raw, (products || []) as ProductRow[], 5)
    const top = candidates[0]
    // 分數太低就不預選。看起來已經選好、其實選錯，比空著更危險
    const autoSelect = top && top.score >= MIN_AUTO_SCORE ? top : null
    return {
      raw: item.raw,
      quantity: item.quantity,
      selected: autoSelect,
      candidates,
      confident: isConfident(candidates),
      stock_warning: autoSelect && autoSelect.stock_qty < item.quantity
        ? `庫存只剩 ${autoSelect.stock_qty}`
        : null,
    }
  })

  // ── 門市 ────────────────────────────────────────────────
  // 全台 7-11 有數千家，不可能整份load進來比對，
  // 先用關鍵字縮小範圍，再在結果裡排序。
  let storeCandidates: (StoreRow & { score: number })[] = []
  if (parsed.store_query) {
    // 輸入會被組進 PostgREST 的 or()，而且 % 與 _ 是 LIKE 萬用字元；
    // 這支整理函式與訂單搜尋共用，不另外複製一份同樣的防護邏輯。
    const keyword = sanitizeOrderSearch(stripStoreNoise(parsed.store_query))
    if (keyword) {
      const { data: stores } = await supabaseAdmin
        .from('stores_711')
        .select('id, store_code, store_name, county, district, address')
        .eq('is_active', true)
        .or(`store_name.ilike.%${keyword}%,store_code.eq.${/^\d+$/.test(keyword) ? keyword : '-1'}`)
        .limit(60)
      storeCandidates = matchStores(parsed.store_query, (stores || []) as StoreRow[], 8)
    }
  }

  const storeConfident = storeCandidates.length > 0
    && storeCandidates[0].score >= 0.9
    && (storeCandidates.length === 1 || storeCandidates[0].score - storeCandidates[1].score >= 0.1)

  const warnings = [...parsed.warnings]
  if (parsed.store_query && storeCandidates.length === 0) {
    warnings.push(`找不到門市「${parsed.store_query}」，請手動選擇`)
  }

  return NextResponse.json({
    success: true,
    data: {
      customer_name: parsed.customer_name,
      phone: parsed.phone,
      store_query: parsed.store_query,
      store: storeConfident ? storeCandidates[0] : null,
      store_candidates: storeCandidates,
      items,
      warnings,
    },
  })
}
