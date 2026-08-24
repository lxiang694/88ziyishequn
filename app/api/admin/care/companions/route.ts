import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

export const runtime = 'nodejs'

function canAccess(perms: string[]) {
  return perms.includes('all') || perms.includes('care.view')
}

/** 後台：陪診員列表（可帶 ?date=&slot= 篩出該時段有空的人，供派工使用） */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!canAccess(auth.admin.permissions)) {
    return NextResponse.json({ success: false, error: '無權限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || ''
  const slot = searchParams.get('slot') || ''

  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, name, phone, email, gender, employment_type, service_areas, certifications, bio, status, completed_count, admin_note, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ success: true, data: [], table_missing: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  let rows = data || []

  // 依可服務時段篩選（派工時使用）
  if (date) {
    const slots = slot && slot !== 'allday' ? [slot, 'allday'] : ['morning', 'afternoon', 'allday']
    const { data: avail } = await supabaseAdmin
      .from('companion_availability')
      .select('companion_id, time_slot')
      .eq('date', date)
      .in('time_slot', slots)
    const ids = new Set((avail || []).map((a: any) => a.companion_id))
    rows = rows.map((r: any) => ({ ...r, available: ids.has(r.id) }))
  }

  return NextResponse.json({ success: true, data: rows })
}

/** 後台：新增陪診員帳號 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '僅超級管理員可新增陪診員' }, { status: 403 })
  }

  try {
    const b = await req.json()
    if (!b.name || !b.phone || !b.password) {
      return NextResponse.json({ success: false, error: '請填寫姓名、手機與密碼' }, { status: 400 })
    }
    if (String(b.password).length < 6) {
      return NextResponse.json({ success: false, error: '密碼至少 6 碼' }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(String(b.password), 10)
    const { data, error } = await supabaseAdmin
      .from('companions')
      .insert({
        name: b.name, phone: String(b.phone).trim(), email: b.email || null,
        password_hash,
        gender: b.gender || null,
        employment_type: b.employment_type || 'parttime',
        service_areas: Array.isArray(b.service_areas) ? b.service_areas : [],
        certifications: b.certifications || null,
        bio: b.bio || null,
        status: b.status || 'active',
      })
      .select('id, name, phone')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: '此手機號碼已註冊' }, { status: 400 })
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: '新增失敗' }, { status: 500 })
  }
}

/** 後台：更新陪診員（狀態、資料、重設密碼） */
export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!auth.admin.permissions.includes('all')) {
    return NextResponse.json({ success: false, error: '僅超級管理員可修改陪診員' }, { status: 403 })
  }

  try {
    const b = await req.json()
    if (!b.id) return NextResponse.json({ success: false, error: '缺少 id' }, { status: 400 })

    const update: any = {}
    for (const f of ['name', 'email', 'gender', 'employment_type', 'certifications', 'bio', 'status', 'admin_note']) {
      if (b[f] !== undefined) update[f] = b[f]
    }
    if (b.service_areas !== undefined) update.service_areas = Array.isArray(b.service_areas) ? b.service_areas : []
    if (b.password) {
      if (String(b.password).length < 6) return NextResponse.json({ success: false, error: '密碼至少 6 碼' }, { status: 400 })
      update.password_hash = await bcrypt.hash(String(b.password), 10)
    }

    const { error } = await supabaseAdmin.from('companions').update(update).eq('id', b.id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: '更新失敗' }, { status: 500 })
  }
}
