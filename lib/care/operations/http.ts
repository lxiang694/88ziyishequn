/** Sprint E Route Handler 共用層：後台、家屬、陪診員各自守門。 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminMiddleware'
import { requireCompanion } from '@/lib/companionAuth'
import { requireUser } from '@/lib/userAuth'
import { writeAuditLog } from '@/lib/audit'
import { hasCarePermission, buildAuditDetail } from '../domain'
import {
  CareInputError, CareRuleError,
  CLOSURE_PERMISSION_KEYS, OPERATIONS_READ_PERMISSIONS,
} from './domain'
import { CareTableMissingError } from './repository'
import type { ActorAdmin, ActorFamily, ActorStaff } from './service'

export const CLOSURE_PERMISSIONS = CLOSURE_PERMISSION_KEYS
/** 營運類讀取；刻意不含結算與個資生命週期權限 */
export const OPERATIONS_READ_PERMISSION = OPERATIONS_READ_PERMISSIONS

export function requireClosurePermission(
  req: NextRequest, required: string | string[],
): { actor: ActorAdmin } | NextResponse {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!hasCarePermission(auth.admin.permissions, required)) {
    return NextResponse.json({ success: false, error: '您沒有這項營運操作的權限' }, { status: 403 })
  }
  return { actor: { id: auth.admin.id, name: auth.admin.name, account: auth.admin.account } }
}

/** 家屬：Supabase Auth 會員；看得到什麼由單筆授權決定，不由身分決定 */
export async function requireFamilyActor(
  req: NextRequest,
): Promise<{ actor: ActorFamily } | NextResponse> {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  return { actor: { userId: auth.user.id } }
}

/** 陪診員：只驗身分；資源歸屬由 Service 層再擋一次 */
export function requireStaffActor(req: NextRequest): { actor: ActorStaff } | NextResponse {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth
  return { actor: { id: auth.companion.id, name: auth.companion.name } }
}

export function closureErrorResponse(e: unknown): NextResponse {
  if (e instanceof CareInputError) {
    return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 })
  }
  if (e instanceof CareRuleError) {
    return NextResponse.json({ success: false, error: e.message }, { status: 409 })
  }
  if (e instanceof CareTableMissingError) {
    return NextResponse.json(
      {
        success: false,
        error: '營運資料表尚未建立，請先執行 migrations/care_operations_closure_schema.sql',
        table_missing: true,
      },
      { status: 503 })
  }
  // 例外訊息不外流：可能含資料庫欄位、值或內部路徑
  return NextResponse.json({ success: false, error: '操作失敗，請稍後再試' }, { status: 500 })
}

/**
 * 稽核。
 *
 * detail 走 buildAuditDetail 的白名單（resource / resource_id /
 * from_status / to_status / reason_code），所以通知內文、家屬意見全文、
 * 品質備註、電話、地址、金額都不可能被寫進去。
 */
export async function auditClosure(
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
  if (!Number.isInteger(n) || n < 1) throw new CareInputError('資源編號不正確')
  return n
}
