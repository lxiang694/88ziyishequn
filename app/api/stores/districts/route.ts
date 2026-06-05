import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const county = searchParams.get('county') || ''
  let query = supabaseAdmin
    .from('stores_711')
    .select('district')
    .eq('is_active', true)
    .neq('district', '')
    .limit(10000)
  if (county) query = query.eq('county', county)
  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const unique = [...new Set((data || []).map((d: any) => d.district))]
  unique.sort((a: string, b: string) => a.localeCompare(b, 'zh-Hant'))
  return NextResponse.json({ success: true, data: unique })
}
