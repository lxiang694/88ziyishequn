import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion } from '@/lib/companionAuth'

export const runtime = 'nodejs'

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX = 8 * 1024 * 1024

/**
 * 陪診員上傳檔案到「私有」儲存空間。
 * kind=doc    → companion-docs（身分證、存摺、學歷）
 * kind=record → care-records（服務過程照片）
 * 僅回傳路徑，不產生公開網址。
 */
export async function POST(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  try {
    const fd = await req.formData()
    const file = fd.get('file') as File
    const kind = (fd.get('kind') as string) === 'record' ? 'record' : 'doc'
    if (!file) return NextResponse.json({ success: false, error: '請選擇檔案' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: '僅支援 JPG、PNG、WebP 或 PDF' }, { status: 400 })
    }
    if (file.size > MAX) {
      return NextResponse.json({ success: false, error: '檔案不可超過 8MB' }, { status: 400 })
    }

    const bucket = kind === 'record' ? 'care-records' : 'companion-docs'
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${auth.companion.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) {
      if ((error as any).message?.includes('Bucket not found')) {
        return NextResponse.json({ success: false, error: '儲存空間尚未建立，請先執行 companion_profile_records.sql' }, { status: 500 })
      }
      return NextResponse.json({ success: false, error: '上傳失敗：' + error.message }, { status: 500 })
    }

    // 立即給一個短效簽名網址供上傳後預覽
    const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(data.path, 300)

    return NextResponse.json({ success: true, path: data.path, bucket, preview: signed?.signedUrl || null })
  } catch {
    return NextResponse.json({ success: false, error: '上傳失敗' }, { status: 500 })
  }
}

/** 取得自己檔案的簽名網址（5 分鐘有效） */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || ''
  const bucket = searchParams.get('bucket') === 'care-records' ? 'care-records' : 'companion-docs'
  if (!path) return NextResponse.json({ success: false, error: '缺少 path' }, { status: 400 })

  // 僅能取自己資料夾（路徑以自己的 id 開頭）
  if (!path.startsWith(`${auth.companion.id}/`)) {
    return NextResponse.json({ success: false, error: '無權存取此檔案' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 300)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, url: data.signedUrl })
}
