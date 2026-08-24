import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** 公開：取得啟用中的陪診方案 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('care_services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    // 表尚未建立時回空陣列，不讓前台整頁壞掉
    if (error.code === '42P01') return NextResponse.json({ success: true, data: [], table_missing: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data: data || [] })
}
