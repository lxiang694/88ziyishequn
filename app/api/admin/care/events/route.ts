import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

/** 後台查看某筆預約的服務過程記錄（含照片簽名網址） */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.admin.permissions.includes('all') && !auth.admin.permissions.includes('care.view')) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const bookingId = Number(searchParams.get('booking_id') || 0)
  if (!bookingId) return NextResponse.json({ success: false, error: '缺少 booking_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('care_booking_events')
    .select('id, event_type, note, photos, created_at, companions(name)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ success: true, data: [], table_missing: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // 照片為私有儲存，逐一產生 5 分鐘簽名網址
  const rows = await Promise.all((data || []).map(async (e: any) => {
    const paths: string[] = Array.isArray(e.photos) ? e.photos : []
    const urls = await Promise.all(paths.map(async p => {
      const { data: s } = await supabaseAdmin.storage.from('care-records').createSignedUrl(p, 300)
      return s?.signedUrl || null
    }))
    return {
      id: e.id,
      event_type: e.event_type,
      note: e.note,
      created_at: e.created_at,
      companion_name: e.companions?.name || '',
      photo_urls: urls.filter(Boolean),
    }
  }))

  return NextResponse.json({ success: true, data: rows })
}
