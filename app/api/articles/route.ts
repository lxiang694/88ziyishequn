import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || ''
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabaseAdmin
    .from('health_articles')
    .select('id, slug, title, excerpt, cover_image_url, category_slug, reading_minutes, view_count, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category) query = query.eq('category_slug', category)

  const { data, error } = await query

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json(
    { success: true, data: data || [] },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } }
  )
}
