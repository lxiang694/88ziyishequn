/**
 * 陪診營運領域模型（Sprint B）—— 純函式，無 I/O，可直接單元測試。
 *
 * 狀態機在三處強制：這裡（Service 呼叫）、Route Handler 的輸入驗證、
 * 以及資料庫 trigger（migrations/care_operations_schema.sql）。
 * 不把流程安全放在 UI。
 */

// ── 初評 ────────────────────────────────────────────────────
export const INTAKE_STATUSES = [
  'submitted', 'in_review', 'needs_more_information', 'declined', 'converted_to_case',
] as const
export type IntakeStatus = (typeof INTAKE_STATUSES)[number]

export const SERVICE_SCENARIOS = [
  'routine_visit', 'visit_with_tests', 'multi_department_or_full_day',
  'post_procedure_discharge', 'unsure',
] as const
export type ServiceScenario = (typeof SERVICE_SCENARIOS)[number]

export const MOBILITY_LEVELS = [
  'independent', 'assistive_device', 'wheelchair', 'manual_review_required',
] as const
export type MobilityLevel = (typeof MOBILITY_LEVELS)[number]

export const TIME_PREFERENCES = ['morning', 'afternoon', 'all_day', 'unspecified'] as const
export type TimePreference = (typeof TIME_PREFERENCES)[number]

export const CONTACT_PREFERENCES = ['phone', 'line'] as const
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number]

/** 婉拒／需補件的原因一律用 code，自由文字只能是補充 */
export const DECLINE_REASON_CODES = [
  'out_of_service_area',
  'date_unavailable',
  'beyond_service_scope',
  'requires_medical_staff',
  'unable_to_contact',
  'duplicate_request',
  'other',
] as const
export type DeclineReasonCode = (typeof DECLINE_REASON_CODES)[number]

export const INTAKE_TRANSITIONS: Record<IntakeStatus, IntakeStatus[]> = {
  submitted: ['in_review', 'declined'],
  in_review: ['needs_more_information', 'declined', 'converted_to_case'],
  needs_more_information: ['in_review', 'declined'],
  declined: [],
  converted_to_case: [],
}

// ── 案件 ────────────────────────────────────────────────────
export const CASE_STATUSES = [
  'needs_assessment', 'awaiting_quote_confirmation', 'awaiting_payment',
  'ready_to_match', 'cancelled',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  needs_assessment: ['awaiting_quote_confirmation', 'cancelled'],
  // 報價作廢時可以退回重報
  awaiting_quote_confirmation: ['awaiting_payment', 'needs_assessment', 'cancelled'],
  awaiting_payment: ['ready_to_match', 'cancelled'],
  ready_to_match: ['cancelled'],
  cancelled: [],
}

export const CASE_CANCEL_REASON_CODES = [
  'family_cancelled', 'no_longer_needed', 'quote_rejected',
  'unable_to_staff', 'beyond_service_scope', 'other',
] as const

// ── 報價 ────────────────────────────────────────────────────
export const QUOTE_STATUSES = ['draft', 'sent', 'confirmed', 'expired', 'cancelled'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['cancelled'],
  expired: [],
  cancelled: [],
}

/** 已確認／已過期／已作廢的報價一律凍結金額與快照 */
export const FROZEN_QUOTE_STATUSES: QuoteStatus[] = ['confirmed', 'expired', 'cancelled']

export function isQuoteFrozen(status: QuoteStatus): boolean {
  return FROZEN_QUOTE_STATUSES.includes(status)
}

// ── 共用轉換檢查 ────────────────────────────────────────────
export function canTransition<S extends string>(
  table: Record<S, S[]>, from: S, to: S,
): boolean {
  const allowed = table[from]
  return Array.isArray(allowed) && allowed.includes(to)
}

export function assertTransition<S extends string>(
  table: Record<S, S[]>, from: S, to: S, label: string,
): void {
  if (from === to) throw new CareRuleError(`${label} 已經是「${to}」狀態`)
  if (!canTransition(table, from, to)) {
    throw new CareRuleError(`${label} 不允許從「${from}」變更為「${to}」`)
  }
}

/** 業務規則錯誤 —— Route Handler 會轉成 409，訊息可直接給使用者看 */
export class CareRuleError extends Error {
  readonly kind = 'care_rule'
  constructor(message: string) {
    super(message)
    this.name = 'CareRuleError'
  }
}

/** 輸入驗證錯誤 —— Route Handler 會轉成 400 */
export class CareInputError extends Error {
  readonly kind = 'care_input'
  readonly field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.name = 'CareInputError'
    this.field = field
  }
}

// ── 報價金額：一律由伺服器端重算，不接受前端傳來的總價 ──────
export interface QuoteLineInput {
  item_code: string
  label_snapshot: string
  unit_price: number
  quantity: number
}

export interface QuoteTotalsInput {
  base_fee: number
  travel_estimate_amount: number
  items: QuoteLineInput[]
}

export function computeQuoteTotal(input: QuoteTotalsInput): number {
  const lines = input.items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  return input.base_fee + input.travel_estimate_amount + lines
}

export function computeLineTotal(line: QuoteLineInput): number {
  return line.unit_price * line.quantity
}

// ── 稽核：只允許安全的 action code，不記錄自由文字 ───────────
export const CARE_AUDIT_ACTIONS = [
  'care_intake.create', 'care_intake.review_start', 'care_intake.request_more_info',
  'care_intake.decline', 'care_intake.convert_to_case',
  'care_case.cancel', 'care_case.mark_payment_received',
  'care_quote.draft_create', 'care_quote.update_draft', 'care_quote.send',
  'care_quote.confirm', 'care_quote.expire', 'care_quote.cancel',
] as const
export type CareAuditAction = (typeof CARE_AUDIT_ACTIONS)[number]

/**
 * 稽核 detail 只允許結構化、非敏感的欄位。
 * 明確擋掉電話、備註、姓名、金額明細、token 等。
 */
const AUDIT_ALLOWED_KEYS = new Set([
  'resource', 'resource_id', 'from_status', 'to_status', 'reason_code', 'quote_version',
])

export function buildAuditDetail(input: Record<string, unknown>): string {
  const safe: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(input)) {
    if (!AUDIT_ALLOWED_KEYS.has(k)) continue
    if (v === null || v === undefined) continue
    if (typeof v === 'number') { safe[k] = v; continue }
    if (typeof v === 'string') {
      // 白名單欄位仍限長，避免有人把自由文字塞進 reason_code
      safe[k] = v.slice(0, 60)
    }
  }
  return JSON.stringify(safe)
}

// ── 授權判斷（純函式，與 HTTP 無關，可單元測試）─────────────
export const CARE_PERMISSION_KEYS = {
  intake: 'care_intake.manage',
  quote: 'care_quote.manage',
  case: 'care_case.manage',
  view: 'care_operations.view',
} as const

export const ALL_CARE_PERMISSIONS: string[] = Object.values(CARE_PERMISSION_KEYS)

/**
 * 能進 /admin 不等於能看陪診個案。
 * 只有 'all'（超級管理員）或明確持有所需的陪診業務權限才通過。
 * 角色名稱、cookie、URL query 與前端 state 都不是權限來源。
 */
export function hasCarePermission(
  granted: readonly string[] | null | undefined,
  required: string | readonly string[],
): boolean {
  if (!Array.isArray(granted) || granted.length === 0) return false
  const need = typeof required === 'string' ? [required] : required
  if (need.length === 0) return false
  if (granted.includes('all')) return true
  return need.some(p => granted.includes(p))
}
