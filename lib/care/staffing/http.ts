/** Sprint C Route Handler 共用層：後台與陪診員端各自守門。 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminMiddleware'
import { requireCompanion } from '@/lib/companionAuth'
import { writeAuditLog } from '@/lib/audit'
import { hasCarePermission, buildAuditDetail } from '../domain'
import {
  CareInputError, CareRuleError, STAFFING_PERMISSION_KEYS, ALL_STAFFING_PERMISSIONS,
} from './domain'
import { CareTableMissingError } from './repository'
import type { ActorAdmin, ActorStaff } from './service'

export const STAFFING_PERMISSIONS = STAFFING_PERMISSION_KEYS
export const STAFFING_ANY_PERMISSION = ALL_STAFFING_PERMISSIONS

export function requireStaffingPermission(
  req: NextRequest, required: string | string[],
): { actor: ActorAdmin } | NextResponse {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!hasCarePermission(auth.admin.permissions, required)) {
    return NextResponse.json({ success: false, error: '您沒有這項陪診人力操作的權限' }, { status: 403 })
  }
  return { actor: { id: auth.admin.id, name: auth.admin.name, account: auth.admin.account } }
}

/** 陪診員只驗身分；資源歸屬由 Service 層再擋一次 */
export function requireOwnStaff(req: NextRequest): { actor: ActorStaff } | NextResponse {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth
  return { actor: { id: auth.companion.id, name: auth.companion.name } }
}

export function staffingErrorResponse(e: unknown): NextResponse {
  if (e instanceof CareInputError) {
    return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 })
  }
  if (e instanceof CareRuleError) {
    return NextResponse.json({ success: false, error: e.message }, { status: 409 })
  }
  if (e instanceof CareTableMissingError) {
    return NextResponse.json(
      { success: false, error: '陪診人力資料表尚未建立，請先執行 migrations/care_staffing_schema.sql', table_missing: true },
      { status: 503 })
  }
  return NextResponse.json({ success: false, error: '操作失敗，請稍後再試' }, { status: 500 })
}

export async function auditStaffing(
  req: NextRequest, actor: { id: number; name: string; account?: string },
  action: string,
  detail: { resource: string; resource_id?: number; from_status?: string; to_status?: string; reason_code?: string },
): Promise<void> {
  await writeAuditLog(
    req,
    { id: actor.id, name: actor.name, account: actor.account || '', role_key: '', permissions: [] },
    action, buildAuditDetail(detail as Record<string, unknown>))
}

export function parseId(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new CareInputError('無效的識別碼')
  return n
}
