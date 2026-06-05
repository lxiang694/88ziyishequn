import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('health_articles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { slug, title, excerpt, cover_image_url, content, category_slug, reading_minutes, is_published } = body

    if (!slug || !title || !content) {
      return NextResponse.json({ success: false, error: '請填寫必要欄位（網址識別碼、標題、內容）' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('health_articles')
      .insert({
        slug,
        title,
        excerpt: excerpt || null,
        cover_image_url: cover_image_url || null,
        content,
        category_slug: category_slug || null,
        reading_minutes: reading_minutes || 5,
        is_published: is_published !== false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '網址識別碼重複，請更換' }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '建立失敗' }, { status: 500 })
  }
}
