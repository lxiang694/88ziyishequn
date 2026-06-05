import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/stores?county=台北市&district=大安區&search=關鍵字&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const county = searchParams.get('county') || ''
  const district = searchParams.get('district') || ''
  const search = searchParams.get('search') || ''
  const limit = parseInt(searchParams.get('limit') || '50')
  let query = supabaseAdmin
    .from('stores_711')
    .select('id, store_code, store_name, county, district, address')
    .eq('is_active', true)
    .limit(limit)
    .order('store_name', { ascending: true })
  if (county) query = query.eq('county', county)
  if (district) query = query.eq('district', district)
  if (search) {
    query = query.or(`store_name.ilike.%${search}%,address.ilike.%${search}%`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
