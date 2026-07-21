import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AdminTokenPayload } from '@/lib/auth'

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || ''
}

export async function writeAuditLog(
  req: NextRequest,
  admin: AdminTokenPayload,
  action: string,
  detail?: string
): Promise<void> {
  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: admin.id,
      admin_name: admin.name,
      admin_account: admin.account,
      action,
      detail: detail || null,
      ip: getClientIp(req),
      user_agent: req.headers.get('user-agent')?.slice(0, 300) || null,
    })
  } catch {
    // 記錄失敗不應影響主流程
  }
}
