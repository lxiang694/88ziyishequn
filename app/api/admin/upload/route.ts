import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucket = (formData.get('bucket') as string) || 'products'

    if (!file) {
      return NextResponse.json({ success: false, error: '請選擇檔案' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: '只支援 JPG、PNG、WebP、GIF 格式' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '檔案大小不可超過 5MB' }, { status: 400 })
    }

    // 副檔名依實際的圖片格式決定，不用上傳者的檔名（避免 .html、.svg 之類混進來）
    const ext = ({ 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[file.type]
    // 資料夾只允許英數字與 - _，不能用 ../ 跳到別的位置
    if (!/^[a-z0-9_-]{1,40}$/i.test(bucket)) return NextResponse.json({ success: false, error: '資料夾名稱不正確' }, { status: 400 })
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `${bucket}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabaseAdmin.storage
      .from('product-images')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ success: false, error: '上傳失敗: ' + error.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ success: false, error: '上傳失敗' }, { status: 500 })
  }
}
