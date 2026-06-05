import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/adminMiddleware'

export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data, error } = await supabaseAdmin.from('admin_roles').select('*').order('id')
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
