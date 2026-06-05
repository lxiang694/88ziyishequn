import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const COUNTY_ORDER = ['基隆市','台北市','新北市','桃園市','新竹市','新竹縣','苗栗縣','台中市','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','台南市','高雄市','屏東縣','宜蘭縣','花蓮縣','台東縣','澎湖縣','金門縣','連江縣']

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('stores_711')
    .select('county')
    .eq('is_active', true)
    .neq('county', '')
    .limit(10000)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const unique = [...new Set((data || []).map((d: any) => d.county))]
  unique.sort((a: string, b: string) => {
    const ai = COUNTY_ORDER.indexOf(a); const bi = COUNTY_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return NextResponse.json({ success: true, data: unique })
}
