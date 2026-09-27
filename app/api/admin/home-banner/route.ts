import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import { isSafeLinkPath } from '@/lib/homeBanner'

export const dynamic = 'force-dynamic'

/** 首頁橫幅跟前台彈窗是同一類「首頁露出」的設定，沿用同一個權限 */
function authorize(req: NextRequest) {
  const result = requireAdmin(req)
  if (result instanceof NextResponse) return result
  const { admin } = result
  if (!admin.permissions.includes('all') && !admin.permissions.includes('site_popup.manage')) {
    return NextResponse.json({ success: false, error: '無權限管理首頁露出' }, { status: 403 })
  }
  return { admin }
}

export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('home_banners')
    .select('image_url, alt_text, link_path, is_active, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({
      success: false, needsMigration: true,
      error: '首頁橫幅資料表尚未建立，請先在 Supabase SQL Editor 執行 migrations/home_banner_schema.sql',
    }, { status: 503 })
  }

  // 遷移跑過但那一列被刪掉時，回一個空的預設值，後台照樣能編輯
  return NextResponse.json({
    success: true,
    data: data || { image_url: null, alt_text: '', link_path: null, is_active: false },
  })
}

export async function PUT(req: NextRequest) {
  const auth = authorize(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()

    const imageUrl = typeof body.image_url === 'string' && body.image_url.trim()
      ? body.image_url.trim() : null
    // 圖片只接受我們自己 storage 的網址。放外站網址的話，對方哪天換圖
    // 或關站，首頁就跟著變 —— 而且那是別人能單方面改動我們首頁的入口。
    if (imageUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(imageUrl)) {
      return NextResponse.json(
        { success: false, error: '圖片請用上方的上傳功能，不要直接貼外站網址' }, { status: 400 })
    }

    const altText = typeof body.alt_text === 'string' ? body.alt_text.trim().slice(0, 200) : ''

    const rawLink = typeof body.link_path === 'string' ? body.link_path.trim() : ''
    if (rawLink && !isSafeLinkPath(rawLink)) {
      return NextResponse.json(
        { success: false, error: '連結必須是站內路徑（以 / 開頭），而且不可帶 ? 或 #' }, { status: 400 })
    }

    const isActive = body.is_active === true
    // 開啟的條件在這裡也擋一次，不只靠前端 —— 前台的顯示條件是
    // 「有圖 ＋ 有說明」，讓資料庫裡出現一列「開啟但沒圖」只會讓人
    // 以為功能壞了
    if (isActive && (!imageUrl || !altText)) {
      return NextResponse.json(
        { success: false, error: '要開啟橫幅，圖片與圖片說明都必須填寫' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('home_banners')
      .upsert({
        id: 1,
        image_url: imageUrl,
        alt_text: altText,
        link_path: rawLink || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
        updated_by_admin_id: auth.admin.id,
      }, { onConflict: 'id' })

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    await writeAuditLog(req, auth.admin, 'home_banner.update',
      `active=${isActive};image=${imageUrl ? 'yes' : 'no'};link=${rawLink || '-'}`)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '儲存失敗' }, { status: 500 })
  }
}
