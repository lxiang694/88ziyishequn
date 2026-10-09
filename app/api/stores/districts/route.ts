import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const PAGE = 1000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const county = searchParams.get('county') || ''
  // Supabase 每次最多回 1000 列。新北市有一千多家門市，只讀第一頁的話
  // 排在後面的區（雙溪、烏來）會從選單上消失，客人選不到。
  const districts = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    let query = supabaseAdmin
      .from('stores_711')
      .select('district')
      .eq('is_active', true)
      .neq('district', '')
      .order('id')
      .range(from, from + PAGE - 1)
    if (county) query = query.eq('county', county)
    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    for (const d of data || []) districts.add((d as any).district)
    if (!data || data.length < PAGE) break
  }
  const unique = [...districts]
  unique.sort((a: string, b: string) => a.localeCompare(b, 'zh-Hant'))
  return NextResponse.json({ success: true, data: unique })
}
