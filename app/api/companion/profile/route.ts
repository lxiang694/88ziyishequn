import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCompanion } from '@/lib/companionAuth'

export const runtime = 'nodejs'

const EDITABLE = [
  'name', 'email', 'gender', 'employment_type', 'birthday', 'address',
  'education', 'school', 'experience', 'certifications', 'bio',
  'emergency_contact', 'emergency_phone', 'emergency_relation',
  'bank_name', 'bank_branch', 'bank_account', 'bank_account_name',
  'id_number',
  'doc_id_front', 'doc_id_back', 'doc_bankbook', 'doc_education', 'doc_certificate',
]

/** 陪診員取得自己的完整資料 */
export async function GET(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('*')
    .eq('id', auth.companion.id)
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: '找不到帳號' }, { status: 404 })

  const { password_hash, ...safe } = data as any
  return NextResponse.json({ success: true, data: safe })
}

/** 更新自己的資料；submit=true 代表送出審核 */
export async function PATCH(req: NextRequest) {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const update: any = {}
    for (const f of EDITABLE) {
      if (body[f] !== undefined) update[f] = body[f] === '' ? null : body[f]
    }
    if (Array.isArray(body.service_areas)) update.service_areas = body.service_areas

    if (body.submit) {
      // 送出審核前檢查必要欄位
      const { data: cur } = await supabaseAdmin
        .from('companions').select('*').eq('id', auth.companion.id).single()
      const merged = { ...(cur || {}), ...update }
      const missing: string[] = []
      if (!merged.name) missing.push('姓名')
      if (!merged.id_number) missing.push('身分證字號')
      if (!merged.address) missing.push('聯絡地址')
      if (!merged.doc_id_front) missing.push('身分證正面')
      if (!merged.doc_id_back) missing.push('身分證反面')
      if (!merged.doc_bankbook) missing.push('存摺封面')
      if (!merged.bank_account) missing.push('銀行帳號')
      if (!Array.isArray(merged.service_areas) || merged.service_areas.length === 0) missing.push('可服務縣市')
      if (missing.length > 0) {
        return NextResponse.json({ success: false, error: `請先完成：${missing.join('、')}` }, { status: 400 })
      }
      update.profile_submitted_at = new Date().toISOString()
      update.reject_reason = null
    }

    const { error } = await supabaseAdmin.from('companions').update(update).eq('id', auth.companion.id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, submitted: !!body.submit })
  } catch {
    return NextResponse.json({ success: false, error: '儲存失敗' }, { status: 500 })
  }
}
