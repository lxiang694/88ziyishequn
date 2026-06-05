import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('health_articles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ success: false, error: '文章不存在' }, { status: 404 })

  return NextResponse.json({ success: true, data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const updateData: any = { updated_at: new Date().toISOString() }
    const fields = ['slug', 'title', 'excerpt', 'cover_image_url', 'content', 'category_slug', 'reading_minutes', 'is_published']
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f]
    }

    const { error } = await supabaseAdmin
      .from('health_articles')
      .update(updateData)
      .eq('id', params.id)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '網址識別碼重複' }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth

  if (!admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '只有超級管理員可刪除文章' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('health_articles')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
