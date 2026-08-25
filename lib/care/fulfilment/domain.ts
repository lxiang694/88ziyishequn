/**
 * Sprint D 服務履約領域模型 —— 純函式，無 I/O，可直接單元測試。
 *
 * 服務主體是 care_bookings（本專案沒有 ServiceOrder/Task/Assignment 三層）。
 * 狀態機在三處強制：這裡、Route Handler 輸入驗證、資料庫 trigger。
 */
import { CareRuleError, CareInputError, canTransition, assertTransition } from '../domain'

export { CareRuleError, CareInputError }

// ── 服務事件 ────────────────────────────────────────────────
export const SERVICE_EVENT_TYPES = [
  'staff_arrived',
  'beneficiary_met',
  'registration_or_checkin_completed',
  'waiting_or_process_in_progress',
  'process_transition',
  'return_arrangement_confirmed',
  'service_handover_ready',
  'requires_supervisor_attention',
] as const
export type ServiceEventType = (typeof SERVICE_EVENT_TYPES)[number]

/** 哪些事件在督導核可後才可能對家屬顯示；其餘一律只留內部 */
export const FAMILY_VISIBLE_EVENT_TYPES: ServiceEventType[] = [
  'staff_arrived',
  'beneficiary_met',
  'registration_or_checkin_completed',
  'waiting_or_process_in_progress',
  'process_transition',
  'return_arrangement_confirmed',
]

export function mayEverBeFamilyVisible(t: ServiceEventType): boolean {
  return FAMILY_VISIBLE_EVENT_TYPES.includes(t)
}

export const EVENT_INVALIDATE_REASONS = [
  'entered_by_mistake', 'wrong_booking', 'duplicate_entry', 'corrected_by_later_event',
] as const

// ── 內部服務紀錄 ────────────────────────────────────────────
export const RECORD_STATUSES = [
  'draft', 'submitted', 'returned_for_revision', 'reviewed', 'superseded',
] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

export const RECORD_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ['submitted', 'superseded'],
  submitted: ['reviewed', 'returned_for_revision'],
  returned_for_revision: ['submitted', 'superseded'],
  reviewed: ['superseded'],
  superseded: [],
}

/** 陪診員只能在這兩個狀態編輯自己的草稿 */
export const RECORD_STAFF_EDITABLE: RecordStatus[] = ['draft', 'returned_for_revision']

export function isRecordStaffEditable(s: RecordStatus): boolean {
  return RECORD_STAFF_EDITABLE.includes(s)
}

export const RECORD_RETURN_REASONS = [
  'incomplete_process_steps', 'unclear_objective_summary',
  'missing_family_follow_up', 'contains_disallowed_content',
] as const

export const FOLLOW_UP_REASONS = [
  'family_confirmation_needed', 'next_appointment_to_arrange',
  'transport_arrangement_pending', 'documents_to_collect',
] as const

// ── 家屬小結 ────────────────────────────────────────────────
export const SUMMARY_STATUSES = [
  'draft', 'in_review', 'published', 'withdrawn', 'superseded',
] as const
export type SummaryStatus = (typeof SUMMARY_STATUSES)[number]

export const SUMMARY_TRANSITIONS: Record<SummaryStatus, SummaryStatus[]> = {
  draft: ['in_review', 'superseded'],
  in_review: ['published', 'draft', 'superseded'],
  published: ['withdrawn', 'superseded'],
  withdrawn: ['superseded'],
  superseded: [],
}

export const SUMMARY_WITHDRAW_REASONS = [
  'content_correction_needed', 'published_in_error',
  'authorization_revoked', 'family_requested',
] as const

/** 家屬看得到的只有這個狀態 */
export function isSummaryVisibleToFamily(s: SummaryStatus): boolean {
  return s === 'published'
}

// ── 異常事件 ────────────────────────────────────────────────
export const INCIDENT_TYPES = [
  'family_contact_needed', 'schedule_or_handover_issue',
  'facility_process_follow_up', 'supervisor_attention_needed',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high'] as const
export const INCIDENT_STATUSES = ['open', 'acknowledged', 'resolved', 'closed'] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['acknowledged', 'resolved'],
  acknowledged: ['resolved'],
  resolved: ['closed'],
  closed: [],
}

export const INCIDENT_RESOLUTIONS = [
  'handled_on_site', 'family_contacted', 'schedule_adjusted',
  'escalated_to_operations', 'no_action_needed',
] as const

export const NOTIFICATION_STATUSES = [
  'not_required', 'pending', 'prepared', 'sent_or_confirmed', 'failed',
] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

/**
 * 目前沒有正式的外部通知管道（LINE / SMS / Email connector 都未接）。
 * 因此系統最多只能推進到 prepared，絕不自行標記為已送出。
 * 資料庫 trigger 也擋著同一件事。
 */
export const NOTIFICATION_PROVIDER_CONFIGURED = false

export const NOTIFICATION_TRANSITIONS: Record<NotificationStatus, NotificationStatus[]> = {
  not_required: ['pending'],
  pending: ['prepared', 'not_required'],
  prepared: ['sent_or_confirmed', 'failed'],
  sent_or_confirmed: [],
  failed: ['pending'],
}

export function assertNotificationTransition(from: NotificationStatus, to: NotificationStatus): void {
  if (to === 'sent_or_confirmed' && !NOTIFICATION_PROVIDER_CONFIGURED) {
    throw new CareRuleError(
      '目前沒有串接正式的通知管道，不能標記為已送出。請人工聯繫家屬後，再由營運記錄結果。',
    )
  }
  assertTransition(NOTIFICATION_TRANSITIONS, from, to, '通知狀態')
}

// ── 家屬授權 ────────────────────────────────────────────────
export const AUTHORIZATION_SCOPES = [
  'receive_service_notification', 'view_service_summary', 'view_service_photo',
] as const
export type AuthorizationScope = (typeof AUTHORIZATION_SCOPES)[number]

/** 本輪不啟用照片檢視：法律、同意書與私有儲存設計都還沒做 */
export const DISABLED_SCOPES: AuthorizationScope[] = ['view_service_photo']

export function assertScopeEnabled(scope: AuthorizationScope): void {
  if (DISABLED_SCOPES.includes(scope)) {
    throw new CareRuleError('照片檢視權限本輪未啟用，需先完成法律、同意與私有儲存設計')
  }
}

/**
 * 家屬授權判斷的唯一來源。
 * 付款人、預約人、聯絡人都**不會**因為身分自動取得閱覽權 ——
 * 必須有一筆對應 booking + user + scope、且未撤回的授權列。
 */
export interface AuthorizationRow {
  booking_id: number
  user_id: string
  scope: string
  revoked_at: string | null
}

export function hasServiceAuthorization(
  rows: readonly AuthorizationRow[] | null | undefined,
  bookingId: number,
  userId: string | null | undefined,
  scope: AuthorizationScope,
): boolean {
  if (!userId || !Array.isArray(rows)) return false
  if (DISABLED_SCOPES.includes(scope)) return false
  return rows.some(r =>
    r.booking_id === bookingId &&
    r.user_id === userId &&
    r.scope === scope &&
    !r.revoked_at)
}

// ── 結算 ────────────────────────────────────────────────────
export const SETTLEMENT_LINE_TYPES = [
  'service_compensation', 'transport_reimbursement', 'manual_adjustment',
] as const
export type SettlementLineType = (typeof SETTLEMENT_LINE_TYPES)[number]

export const LINE_STATUSES = [
  'pending_review', 'approved', 'rejected', 'published_to_staff', 'batched',
] as const
export type LineStatus = (typeof LINE_STATUSES)[number]

export const LINE_TRANSITIONS: Record<LineStatus, LineStatus[]> = {
  pending_review: ['approved', 'rejected'],
  approved: ['batched', 'published_to_staff', 'pending_review'],
  batched: ['published_to_staff'],
  published_to_staff: [],
  rejected: ['pending_review'],
}

/** 陪診員只看得到自己已發布的明細 */
export function isLineVisibleToStaff(s: LineStatus): boolean {
  return s === 'published_to_staff'
}

export const BATCH_STATUSES = ['draft', 'approved', 'published', 'closed'] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]

export const BATCH_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  draft: ['approved'],
  approved: ['published', 'draft'],
  published: ['closed'],
  closed: [],
}

export const LINE_ADJUSTMENT_REASONS = [
  'overtime_agreed', 'extra_transport_agreed', 'correction_of_previous_line',
  'service_shortened', 'other_approved_by_supervisor',
] as const

/**
 * 全職不在本輪產生報酬 line，只提供服務統計。
 * 這條規則在 Service、資料庫 trigger 兩處都擋。
 */
export function assertPartTimeForSettlement(employmentType: string): void {
  if (employmentType !== 'parttime') {
    throw new CareRuleError('全職陪診員本輪不產生結算明細，只提供服務統計')
  }
}

// ── 內容守門：禁止醫療內容 ──────────────────────────────────
/**
 * 這不是萬無一失的過濾器，也不假裝是。
 * 它擋的是最常見的誤填，讓填寫者當場看到提示，
 * 真正的防線是 UI 說明、欄位設計與督導審核。
 */
const MEDICAL_TERMS = [
  '診斷', '確診', '醫囑', '處方', '藥方', '劑量', '毫克', 'mg/',
  '建議服用', '建議停藥', '停藥', '加藥', '減藥', '換藥',
  '病歷', '化驗', '報告顯示', '判讀', '罹患', '癌', '腫瘤',
]

export interface ContentCheckResult {
  ok: boolean
  hits: string[]
}

export function checkNoMedicalContent(text: string | null | undefined): ContentCheckResult {
  if (!text) return { ok: true, hits: [] }
  const hits = MEDICAL_TERMS.filter(t => text.includes(t))
  return { ok: hits.length === 0, hits }
}

export function assertNoMedicalContent(text: string | null | undefined, field: string): void {
  const r = checkNoMedicalContent(text)
  if (!r.ok) {
    throw new CareInputError(
      `${field} 不可記錄醫療內容（偵測到「${r.hits.join('、')}」）。` +
      '請只描述客觀流程與需家屬處理的事項；診斷、用藥與治療相關問題請家屬直接詢問醫療人員。',
      field,
    )
  }
}

// ── 履約權限 ────────────────────────────────────────────────
export const FULFILMENT_PERMISSION_KEYS = {
  record: 'care_record.review',
  summary: 'care_summary.review',
  incident: 'care_incident.manage',
  settlement: 'care_settlement.manage',
  view: 'care_operations.view',
} as const

export const ALL_FULFILMENT_PERMISSIONS: string[] = Object.values(FULFILMENT_PERMISSION_KEYS)

/** 只有這個權限看得到金額；其他角色即使在 Admin portal 也不行 */
export const FINANCE_ONLY_PERMISSION = FULFILMENT_PERMISSION_KEYS.settlement

// ── 共用轉換工具（轉出，讓呼叫端不必兩處 import）────────────
export { canTransition, assertTransition }
