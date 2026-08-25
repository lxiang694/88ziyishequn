/**
 * Sprint D 履約 Route Handler 共用層。
 * 三個身分 realm 各有各的守門，不共用同一個 guard。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminMiddleware'
import { requireCompanion } from '@/lib/companionAuth'
import { requireUser } from '@/lib/userAuth'
import { writeAuditLog } from '@/lib/audit'
import { hasCarePermission, buildAuditDetail } from '../domain'
import { CareInputError, CareRuleError, FULFILMENT_PERMISSION_KEYS, ALL_FULFILMENT_PERMISSIONS } from './domain'
import { CareTableMissingError } from './repository'
import type { ActorAdmin, ActorCompanion } from './service'

export const FULFILMENT_PERMISSIONS = FULFILMENT_PERMISSION_KEYS
export const FULFILMENT_ANY_PERMISSION = ALL_FULFILMENT_PERMISSIONS

/** 後台：要求明確的履約業務權限 */
export function requireFulfilmentPermission(
  req: NextRequest, required: string | string[],
): { actor: ActorAdmin } | NextResponse {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  if (!hasCarePermission(auth.admin.permissions, required)) {
    return NextResponse.json({ success: false, error: '您沒有這項陪診履約操作的權限' }, { status: 403 })
  }
  return { actor: { id: auth.admin.id, name: auth.admin.name, account: auth.admin.account } }
}

/** 陪診員：只驗身分；資源歸屬由 Service 層再擋一次 */
export function requireStaff(req: NextRequest): { actor: ActorCompanion } | NextResponse {
  const auth = requireCompanion(req)
  if (auth instanceof NextResponse) return auth
  return { actor: { id: auth.companion.id, name: auth.companion.name } }
}

/** 家屬：Supabase Auth 會員；是否看得到由單筆授權決定 */
export async function requireFamilyUser(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  return { userId: auth.user.id }
}

export function fulfilmentErrorResponse(e: unknown): NextResponse {
  if (e instanceof CareInputError) {
    return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 })
  }
  if (e instanceof CareRuleError) {
    return NextResponse.json({ success: false, error: e.message }, { status: 409 })
  }
  if (e instanceof CareTableMissingError) {
    return NextResponse.json(
      { success: false, error: e.message, table_missing: true }, { status: 503 })
  }
  // 不外洩堆疊或資料庫訊息
  return NextResponse.json({ success: false, error: '操作失敗，請稍後再試' }, { status: 500 })
}

/**
 * 稽核：沿用 Sprint B 的白名單，只寫安全的資源引用與狀態變化。
 * 服務紀錄全文、家屬備註、電話、地址、金額 payload 都不會進來。
 */
export async function auditFulfilment(
  req: NextRequest,
  actor: { id: number; name: string; account?: string },
  action: string,
  detail: {
    resource: string; resource_id?: number
    from_status?: string; to_status?: string; reason_code?: string
  },
): Promise<void> {
  await writeAuditLog(
    req,
    { id: actor.id, name: actor.name, account: actor.account || '', role_key: '', permissions: [] },
    action,
    buildAuditDetail(detail as Record<string, unknown>),
  )
}

export function parseId(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new CareInputError('無效的識別碼')
  return n
}
