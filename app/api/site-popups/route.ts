import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { toPublicPopup, type PopupRow } from '@/lib/popups/domain'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 前台要用的彈窗清單（公開）。
 *
 * 只回傳已啟用的，且欄位固定經過 toPublicPopup —— 後台自用的名稱、
 * 建立者、時間戳不會外流。實際要顯示哪一個由瀏覽器端依當前路徑決定，
 * 因為這個端點會被快取，不能綁定單一頁面。
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_popups')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ success: true, data: [] })

    const rows = ((data as PopupRow[]) || []).map(r => ({
      ...toPublicPopup(r),
      // 顯示規則要在瀏覽器端判斷，所以這幾個欄位一起送
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      include_paths: r.include_paths || [],
      exclude_paths: r.exclude_paths || [],
      is_active: true,
      priority: r.priority,
    }))

    return NextResponse.json(
      { success: true, data: rows },
      { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    // 彈窗壞掉不該影響整個網站
    return NextResponse.json({ success: true, data: [] })
  }
}
