import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { generateOrderNo, validateTWPhone } from '@/lib/utils'
import {
  parseResolvedItems, isValidSource, QuickOrderInputError,
  QUICK_ORDER_PERMISSION, DEFAULT_QUICK_ORDER_SOURCE,
} from '@/lib/quickOrder/domain'

/**
 * POST /api/admin/quick-order —— 後台代客下單。
 *
 * 只接受「已經確認過的」品項（product_id + variant_id + 數量），
 * 不接受貼上的原始文字 —— 解析與比對在 /parse，人確認過才到這裡。
 *
 * ── 價格由伺服器決定 ────────────────────────────────────
 * 畫面上傳來的單價一律忽略，重新從 product_variants 查。
 * 前端能改的東西不能決定收多少錢，這條線在任何情況下都不放寬。
 *
 * ── 庫存由 place_order 扣 ───────────────────────────────
 * 與前台結帳共用同一個 RPC，庫存檢查與扣減都是原子的。
 * 不另外寫一套，否則兩條路徑的庫存邏輯早晚會不一致。
 */
export async function POST(req: NextRequest) {
  const auth = requirePermission(req, QUICK_ORDER_PERMISSION)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: '請求格式錯誤' }, { status: 400 })
  }

  const customer_name = String(body?.customer_name || '').trim()
  const phone = String(body?.phone || '').trim()
  const note = String(body?.note || '').trim()
  const store_id = Number(body?.store_id)
  const source = isValidSource(body?.source) ? body.source : DEFAULT_QUICK_ORDER_SOURCE

  if (!customer_name) {
    return NextResponse.json({ success: false, error: '請填寫收件人姓名' }, { status: 400 })
  }
  if (customer_name.length > 40) {
    return NextResponse.json({ success: false, error: '姓名過長' }, { status: 400 })
  }
  if (!validateTWPhone(phone)) {
    return NextResponse.json({ success: false, error: '手機號碼格式不正確（09 開頭 10 碼）' }, { status: 400 })
  }
  if (!Number.isInteger(store_id) || store_id <= 0) {
    return NextResponse.json({ success: false, error: '請選擇 7-11 門市' }, { status: 400 })
  }
  if (note.length > 200) {
    return NextResponse.json({ success: false, error: '備註過長' }, { status: 400 })
  }

  let resolved
  try {
    resolved = parseResolvedItems(body?.items)
  } catch (e) {
    if (e instanceof QuickOrderInputError) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 })
    }
    throw e
  }

  // ── 門市：用 id 重查，不信畫面傳來的名稱與地址 ─────────
  const { data: store, error: sErr } = await supabaseAdmin
    .from('stores_711')
    .select('id, store_name, county, district, address, is_active')
    .eq('id', store_id)
    .maybeSingle()

  if (sErr) {
    console.error('[quick-order] load store failed', sErr)
    return NextResponse.json({ success: false, error: '讀取門市失敗' }, { status: 500 })
  }
  if (!store || !store.is_active) {
    return NextResponse.json({ success: false, error: '門市不存在或已停用，請重新選擇' }, { status: 400 })
  }

  // ── 商品：用 variant_id 重查名稱、價格、上架狀態 ───────
  const variantIds = resolved.map(i => i.variant_id)
  const { data: variants, error: vErr } = await supabaseAdmin
    .from('product_variants')
    .select('id, product_id, variant_name, sale_price, sku_code, is_active, products(id,product_name,cover_image_url,is_published)')
    .in('id', variantIds)

  if (vErr) {
    console.error('[quick-order] load variants failed', vErr)
    return NextResponse.json({ success: false, error: '讀取商品失敗' }, { status: 500 })
  }

  const byId = new Map<number, any>((variants || []).map((v: any) => [v.id, v]))
  const items = []
  for (const r of resolved) {
    const v = byId.get(r.variant_id)
    if (!v) {
      return NextResponse.json({ success: false, error: '有商品規格不存在，請重新選擇' }, { status: 400 })
    }
    const product = Array.isArray(v.products) ? v.products[0] : v.products
    if (!v.is_active || !product?.is_published) {
      return NextResponse.json({
        success: false,
        error: `「${product?.product_name || '商品'}」已下架，無法建立訂單`,
      }, { status: 400 })
    }
    // 畫面送來的 product_id 必須與規格實際所屬的商品一致，
    // 否則訂單明細會顯示 A 商品卻扣 B 商品的庫存
    if (product.id !== r.product_id) {
      return NextResponse.json({ success: false, error: '商品與規格不符，請重新選擇' }, { status: 400 })
    }

    items.push({
      product_id: product.id,
      product_name: product.product_name,
      cover_image_url: product.cover_image_url || null,
      variant_id: v.id,
      variant_name: v.variant_name,
      sku_code: v.sku_code || null,
      unit_price: v.sale_price,   // ← 伺服器決定，不看前端
      quantity: r.quantity,
    })
  }

  // ── 建立訂單（與前台共用同一個原子 RPC）────────────────
  const order_no = generateOrderNo()
  const { data, error } = await supabaseAdmin.rpc('place_order', {
    p_order_no: order_no,
    p_customer_name: customer_name,
    p_phone: phone,
    p_line_id: null,
    p_store_id: store.id,
    p_store_name: store.store_name,
    p_store_address: store.address,
    p_county: store.county || '',
    p_district: store.district || '',
    p_note: note || null,
    p_items: items,
  })

  if (error) {
    console.error('[quick-order] place_order failed', { order_no, code: error.code })
    const msg = error.message || ''
    if (msg.includes('庫存不足')) {
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }
    if (msg.includes('庫存扣減失敗')) {
      return NextResponse.json({ success: false, error: '庫存剛被其他訂單扣掉，請重新確認' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: '建立訂單失敗，請稍後再試' }, { status: 500 })
  }

  const result = data as any

  // ── 補記來源與經手人 ────────────────────────────────────
  // 訂單已經成立，這一步失敗不能讓整筆下單失敗（庫存已扣、RPC 已提交），
  // 但要留下明確紀錄。欄位尚未 migrate 時這裡會失敗，屬於預期情況。
  const { error: metaErr } = await supabaseAdmin
    .from('orders')
    .update({ source, created_by_admin_id: admin.id })
    .eq('order_no', order_no)

  if (metaErr) {
    console.error('[quick-order] 訂單已建立但來源未記錄'
      + '（若尚未執行 migrations/orders_source.sql 屬預期）', {
      order_no, code: metaErr.code,
    })
  }

  // 代客下單會接觸到客戶姓名與手機，留稽核紀錄
  await writeAuditLog(req, admin, 'quick_order_create',
    `訂單 ${order_no}／${items.length} 項／來源 ${source}`)

  // 回傳一段可以直接貼回 Line 的確認訊息 ——
  // 下單後還要自己打一次確認訊息，是這個流程剩下最花時間的一步
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const confirmText = [
    `${customer_name} 您好，訂單已成立 👌`,
    '',
    ...items.map(i => `・${i.product_name}${i.variant_name ? ` ${i.variant_name}` : ''} ×${i.quantity}`),
    '',
    `金額：NT$${total.toLocaleString('en-US')}（貨到付款）`,
    `取貨門市：7-11 ${store.store_name}（${store.county}${store.district}）`,
    `訂單編號：${order_no}`,
    '',
    '出貨後會再通知您一次，感謝訂購 🙏',
  ].join('\n')

  return NextResponse.json({
    success: true,
    data: {
      order_no: result?.order_no || order_no,
      order_id: result?.order_id ?? null,
      total_amount: result?.total_amount ?? total,
      items_count: result?.items_count ?? items.length,
      source_recorded: !metaErr,
      confirm_text: confirmText,
    },
  })
}
