/**
 * Sprint D 履約輸入驗證 —— 純函式，可單元測試。
 *
 * 原則與 Sprint B 相同：白名單、限長、伺服器決定時間與 actor。
 * 額外多一層：自由文字都要過 assertNoMedicalContent()。
 */
import {
  SERVICE_EVENT_TYPES, EVENT_INVALIDATE_REASONS,
  RECORD_RETURN_REASONS, FOLLOW_UP_REASONS,
  SUMMARY_WITHDRAW_REASONS,
  INCIDENT_TYPES, INCIDENT_SEVERITIES, INCIDENT_RESOLUTIONS,
  AUTHORIZATION_SCOPES, SETTLEMENT_LINE_TYPES, LINE_ADJUSTMENT_REASONS,
  CareInputError, assertNoMedicalContent,
  type ServiceEventType, type IncidentType, type AuthorizationScope,
  type SettlementLineType,
} from './domain'

const LIMITS = {
  EVENT_NOTE: 120,
  RECORD_SUMMARY: 500,
  INCIDENT_DESC: 300,
  SUMMARY_WINDOW: 200,
  SUMMARY_STEPS: 600,
  SUMMARY_ACTIONS: 600,
  SUMMARY_NEXT: 400,
  SUMMARY_HANDOVER: 300,
  REVIEW_NOTE: 200,
  BASIS: 200,
}
export const FULFILMENT_LIMITS = LIMITS

function text(v: unknown, field: string, max: number, required = true): string {
  if (typeof v !== 'string') {
    if (!required && (v === undefined || v === null)) return ''
    throw new CareInputError(`${field} 必須是文字`, field)
  }
  const s = v.trim()
  if (required && !s) throw new CareInputError(`${field} 為必填`, field)
  if (s.length > max) throw new CareInputError(`${field} 超過 ${max} 字上限`, field)
  return s
}

/** 自由文字一律加上醫療內容守門 */
function safeText(v: unknown, field: string, max: number, required = true): string {
  const s = text(v, field, max, required)
  assertNoMedicalContent(s, field)
  return s
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new CareInputError(`${field} 不是允許的選項`, field)
  }
  return v as T
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new CareInputError(`${field} 必須是 true 或 false`, field)
  return v
}

function posInt(v: unknown, field: string, max = 100_000_000): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new CareInputError(`${field} 必須是 0 或正整數`, field)
  }
  if (v > max) throw new CareInputError(`${field} 超過上限`, field)
  return v
}

function isoDate(v: unknown, field: string): string {
  const s = text(v, field, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CareInputError(`${field} 格式須為 YYYY-MM-DD`, field)
  return s
}

// ── 服務事件 ────────────────────────────────────────────────
export interface AppendEventInput {
  event_type: ServiceEventType
  family_note: string | null
}

/**
 * 刻意沒有 occurred_at / visibility / companion_id：
 * 時間由資料庫寫、可見性由督導決定、身分取自登入 token。
 */
export function parseAppendEvent(raw: unknown): AppendEventInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const note = safeText(b.family_note, '給家屬的說明', LIMITS.EVENT_NOTE, false)
  return {
    event_type: oneOf(b.event_type, SERVICE_EVENT_TYPES, '事件類型'),
    family_note: note || null,
  }
}

export function parseInvalidateEvent(raw: unknown): { reason_code: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { reason_code: oneOf(b.reason_code, EVENT_INVALIDATE_REASONS, '作廢原因') }
}

// ── 內部服務紀錄 ────────────────────────────────────────────
export interface RecordDraftInput {
  met_completed: boolean
  checkin_completed: boolean
  process_handover_completed: boolean
  return_arrangement_completed: boolean
  family_contact_completed: boolean
  family_follow_up_needed: boolean
  follow_up_reason_code: string | null
  objective_summary: string | null
}

export function parseRecordDraft(raw: unknown): RecordDraftInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>

  const needsFollowUp = bool(b.family_follow_up_needed ?? false, '是否需要家屬後續處理')
  let reason: string | null = null
  if (needsFollowUp) {
    reason = oneOf(b.follow_up_reason_code, FOLLOW_UP_REASONS, '需家屬處理的原因')
  }

  const summary = safeText(b.objective_summary, '客觀說明', LIMITS.RECORD_SUMMARY, false)

  return {
    met_completed: bool(b.met_completed ?? false, '已會合'),
    checkin_completed: bool(b.checkin_completed ?? false, '已完成報到'),
    process_handover_completed: bool(b.process_handover_completed ?? false, '流程銜接完成'),
    return_arrangement_completed: bool(b.return_arrangement_completed ?? false, '返程安排完成'),
    family_contact_completed: bool(b.family_contact_completed ?? false, '已聯繫家屬'),
    family_follow_up_needed: needsFollowUp,
    follow_up_reason_code: reason,
    objective_summary: summary || null,
  }
}

export function parseReturnRecord(raw: unknown): { reason_code: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { reason_code: oneOf(b.reason_code, RECORD_RETURN_REASONS, '退回原因') }
}

// ── 家屬小結 ────────────────────────────────────────────────
export interface SummaryDraftInput {
  service_window_text: string
  completed_steps_text: string
  family_actions_text: string | null
  next_arrangement_text: string | null
  handover_status_text: string | null
}

export function parseSummaryDraft(raw: unknown): SummaryDraftInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    service_window_text: safeText(b.service_window_text, '服務時間', LIMITS.SUMMARY_WINDOW),
    completed_steps_text: safeText(b.completed_steps_text, '已完成流程', LIMITS.SUMMARY_STEPS),
    family_actions_text: safeText(b.family_actions_text, '需家屬確認事項', LIMITS.SUMMARY_ACTIONS, false) || null,
    next_arrangement_text: safeText(b.next_arrangement_text, '下次安排', LIMITS.SUMMARY_NEXT, false) || null,
    handover_status_text: safeText(b.handover_status_text, '交接狀態', LIMITS.SUMMARY_HANDOVER, false) || null,
  }
}

export function parseWithdrawSummary(raw: unknown): { reason_code: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { reason_code: oneOf(b.reason_code, SUMMARY_WITHDRAW_REASONS, '撤回原因') }
}

// ── 異常事件 ────────────────────────────────────────────────
export interface IncidentInput {
  incident_type: IncidentType
  severity: string
  description: string | null
}

export function parseIncident(raw: unknown): IncidentInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    incident_type: oneOf(b.incident_type, INCIDENT_TYPES, '異常類型'),
    severity: oneOf(b.severity ?? 'low', INCIDENT_SEVERITIES, '處理優先級'),
    description: safeText(b.description, '狀況說明', LIMITS.INCIDENT_DESC, false) || null,
  }
}

export function parseResolveIncident(raw: unknown): { resolution_code: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { resolution_code: oneOf(b.resolution_code, INCIDENT_RESOLUTIONS, '處理結果') }
}

// ── 家屬授權 ────────────────────────────────────────────────
export interface GrantAuthorizationInput {
  user_id: string
  scope: AuthorizationScope
}

export function parseGrantAuthorization(raw: unknown): GrantAuthorizationInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const uid = text(b.user_id, '會員識別碼', 40)
  if (!/^[0-9a-f-]{36}$/i.test(uid)) throw new CareInputError('會員識別碼格式不正確', 'user_id')
  return { user_id: uid, scope: oneOf(b.scope, AUTHORIZATION_SCOPES, '授權範圍') }
}

// ── 結算 ────────────────────────────────────────────────────
export interface ManualLineInput {
  line_type: SettlementLineType
  amount: number
  basis_snapshot: string
  reason_code: string
}

export function parseManualLine(raw: unknown): ManualLineInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    line_type: oneOf(b.line_type, SETTLEMENT_LINE_TYPES, '明細類型'),
    amount: posInt(b.amount, '金額'),
    basis_snapshot: safeText(b.basis_snapshot, '計算依據', LIMITS.BASIS),
    reason_code: oneOf(b.reason_code, LINE_ADJUSTMENT_REASONS, '調整原因'),
  }
}

export function parseReviewLine(raw: unknown): { decision: 'approve' | 'reject'; review_note: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  const decision = oneOf(b.decision, ['approve', 'reject'] as const, '審核決定')
  return {
    decision,
    review_note: safeText(b.review_note, '審核備註', LIMITS.REVIEW_NOTE, false) || null,
  }
}

export function parseBatchPeriod(raw: unknown): { period_start: string; period_end: string } {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const start = isoDate(b.period_start, '期間起日')
  const end = isoDate(b.period_end, '期間迄日')
  if (end < start) throw new CareInputError('期間迄日不可早於起日', 'period_end')
  return { period_start: start, period_end: end }
}
