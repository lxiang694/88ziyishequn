/**
 * 陪診營運 Route Handler 共用層。
 * 統一權限檢查、錯誤轉換與稽核，避免每個 endpoint 各寫一套。
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminMiddleware'
import { writeAuditLog } from '@/lib/audit'
import {
  CareInputError, CareRuleError, buildAuditDetail, hasCarePermission,
  CARE_PERMISSION_KEYS, ALL_CARE_PERMISSIONS, type CareAuditAction,
} from './domain'
import { CareTableMissingError } from './repository'
import type { ActorAdmin } from './service'

/** Sprint B 新增的業務權限（定義在 domain 層，這裡只是轉出） */
export const CARE_PERMISSIONS = CARE_PERMISSION_KEYS

/** 讀取類操作：任一 care 權限即可 */
export const CARE_ANY_PERMISSION = ALL_CARE_PERMISSIONS

export interface CareAuthOk { actor: ActorAdmin }

/**
 * 能進 /admin 不等於能看陪診個案：這裡要求明確的業務權限。
 * 'all'（超級管理員）視為擁有全部權限。
 */
export function requireCarePermission(
  req: NextRequest, required: string | string[],
): CareAuthOk | NextResponse {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  if (!hasCarePermission(auth.admin.permissions, required)) {
    return NextResponse.json(
      { success: false, error: '您沒有陪診營運的操作權限' }, { status: 403 },
    )
  }
  return {
    actor: { id: auth.admin.id, name: auth.admin.name, account: auth.admin.account },
  }
}

/** 統一把領域錯誤轉成適當的 HTTP 狀態，且不外洩堆疊 */
export function careErrorResponse(e: unknown): NextResponse {
  if (e instanceof CareInputError) {
    return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 })
  }
  if (e instanceof CareRuleError) {
    return NextResponse.json({ success: false, error: e.message }, { status: 409 })
  }
  if (e instanceof CareTableMissingError) {
    return NextResponse.json(
      { success: false, error: e.message, table_missing: true }, { status: 503 },
    )
  }
  return NextResponse.json({ success: false, error: '操作失敗，請稍後再試' }, { status: 500 })
}

/**
 * 稽核只寫安全欄位。detail 走 buildAuditDetail() 的白名單，
 * 自由文字、電話、金額明細、完整表單都不會進 admin_audit_logs。
 */
export async function auditCare(
  req: NextRequest, actor: ActorAdmin, action: CareAuditAction,
  detail: { resource: string; resource_id?: number; from_status?: string; to_status?: string; reason_code?: string; quote_version?: number },
): Promise<void> {
  await writeAuditLog(
    req,
    { id: actor.id, name: actor.name, account: actor.account, role_key: '', permissions: [] },
    action,
    buildAuditDetail(detail as Record<string, unknown>),
  )
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || ''
}

/** 路徑參數的 id 一律驗證，不直接丟進查詢 */
export function parseId(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new CareInputError('無效的識別碼')
  return n
}
