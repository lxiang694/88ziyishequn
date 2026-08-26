/**
 * Sprint E 輸入驗證 —— 純函式，可單元測試。
 *
 * 原則同前幾輪：白名單、限長、actor／status／timestamp 由伺服器決定。
 * 這一輪多了一條：通知的 title/body 完全不接受 client 傳入，
 * 只接受 type，內容由 domain 的固定模板產生。
 */
import {
  NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, OUTBOX_SUPPRESSION_REASONS,
  CONCERN_CATEGORIES, CONCERN_RESOLUTION_CODES, CONCERN_SOURCES,
  QUALITY_FOLLOW_UP_ACTIONS, POLICY_KINDS,
  LIFECYCLE_RESOURCE_KINDS, LIFECYCLE_REASON_CODES,
  CareInputError,
  type NotificationType, type NotificationCategory,
} from './domain'

const MAX = {
  COMMENT: 300, DESCRIPTION: 500, NOTE: 500, STAFF_NOTE: 200,
  LABEL: 40, BODY: 20000, LINK: 200,
}
export const CLOSURE_LIMITS = MAX

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

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new CareInputError(`${field} 不是允許的選項`, field)
  }
  return v as T
}

function score(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) {
    throw new CareInputError(`${field} 須為 1 到 5 的整數`, field)
  }
  return v
}

function isoDate(v: unknown, field: string, required = true): string {
  if (!required && (v === undefined || v === null || v === '')) return ''
  const s = text(v, field, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CareInputError(`${field} 格式須為 YYYY-MM-DD`, field)
  return s
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new CareInputError(`${field} 必須是 true 或 false`, field)
  return v
}

function optionalBool(v: unknown, field: string): boolean | null {
  if (v === undefined || v === null) return null
  return bool(v, field)
}

/**
 * 明顯的個資樣式。
 *
 * 這不是完整的個資偵測——那做不到。它擋的是最常見、
 * 也最容易在回饋欄位裡出現的四種：手機、市話、身分證字號、Email。
 * 目的是在使用者按下送出前就提醒他，而不是事後才發現存進資料庫。
 */
const PII_PATTERNS: [RegExp, string][] = [
  [/09\d{8}/, '手機號碼'],
  // (?!9) 讓市話樣式不要也吃掉手機號碼——否則使用者會看到
  // 「含有手機號碼、市話號碼」這種看不懂的訊息
  [/0(?!9)\d{1,2}-?\d{6,8}/, '市話號碼'],
  [/[A-Za-z][12]\d{8}/, '身分證字號'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'Email'],
]

export function findPersonalData(s: string): string[] {
  const hits: string[] = []
  for (const [re, label] of PII_PATTERNS) {
    if (re.test(s) && !hits.includes(label)) hits.push(label)
  }
  return hits
}

export function assertNoPersonalData(s: string | null | undefined, field: string): void {
  if (!s) return
  const hits = findPersonalData(s)
  if (hits.length > 0) {
    throw new CareInputError(
      `${field} 看起來含有${hits.join('、')}。這個欄位不需要這些資訊，請移除後再送出。`, field)
  }
}

// ── 通知 ────────────────────────────────────────────────────
export interface CreateNotificationInput {
  notification_type: NotificationType
  link_path: string | null
}

/**
 * 刻意沒有 title / body / recipient / status / created_at：
 * 內容由模板產生，收件人由 Service 從資源關係推出，時間由資料庫寫。
 */
export function parseCreateNotification(raw: unknown): CreateNotificationInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const link = text(b.link_path, '連結', MAX.LINK, false)
  return {
    notification_type: oneOf(b.notification_type, NOTIFICATION_TYPES, '通知類型'),
    link_path: link || null,
  }
}

export interface NotificationPreferenceInput {
  category: NotificationCategory
  in_app_enabled: boolean
}

/**
 * 刻意沒有 external_channel_opt_in：
 * 外部通道還沒有 provider，也還沒有法務確認的 opt-in 文案，
 * 這時候開放這個欄位等於讓人在不知道自己同意了什麼的情況下同意。
 */
export function parseNotificationPreference(raw: unknown): NotificationPreferenceInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    category: oneOf(b.category, NOTIFICATION_CATEGORIES, '通知類別'),
    in_app_enabled: bool(b.in_app_enabled, '站內通知'),
  }
}

export function parseSuppressOutbox(raw: unknown): { reason_code: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { reason_code: oneOf(b.reason_code, OUTBOX_SUPPRESSION_REASONS, '抑制原因') }
}

// ── 回饋 ────────────────────────────────────────────────────
export interface SubmitFeedbackInput {
  score_reassurance: number
  score_communication: number
  score_process_support: number
  comment: string | null
}

export function parseSubmitFeedback(raw: unknown): SubmitFeedbackInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const comment = text(b.comment, '補充意見', MAX.COMMENT, false) || null
  assertNoPersonalData(comment, '補充意見')
  return {
    score_reassurance: score(b.score_reassurance, '整體安心感'),
    score_communication: score(b.score_communication, '溝通清楚度'),
    score_process_support: score(b.score_process_support, '流程協助'),
    comment,
  }
}

// ── 意見／申訴 ──────────────────────────────────────────────
export interface CreateConcernInput {
  category: string
  description: string
}

export function parseCreateConcern(raw: unknown): CreateConcernInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const description = text(b.description, '說明', MAX.DESCRIPTION)
  assertNoPersonalData(description, '說明')
  return {
    category: oneOf(b.category, CONCERN_CATEGORIES, '類別'),
    description,
  }
}

export function parseAdminCreateConcern(raw: unknown): CreateConcernInput & { source: string } {
  const base = parseCreateConcern(raw)
  const b = raw as Record<string, unknown>
  return { ...base, source: oneOf(b.source, CONCERN_SOURCES, '來源') }
}

export function parseAssignConcern(raw: unknown): { owner_admin_id: number; due_date: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  const id = b.owner_admin_id
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
    throw new CareInputError('負責人不正確', 'owner_admin_id')
  }
  return { owner_admin_id: id, due_date: isoDate(b.due_date, '到期日', false) || null }
}

export function parseResolveConcern(raw: unknown): { resolution_code: string; internal_note: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  const note = text(b.internal_note, '內部備註', MAX.NOTE, false) || null
  assertNoPersonalData(note, '內部備註')
  return {
    resolution_code: oneOf(b.resolution_code, CONCERN_RESOLUTION_CODES, '處理結果'),
    internal_note: note,
  }
}

// ── 品質覆核 ────────────────────────────────────────────────
export interface CompleteQualityReviewInput {
  chk_events_complete: boolean | null
  chk_record_on_time: boolean | null
  chk_summary_clear: boolean | null
  chk_authorization_correct: boolean | null
  chk_communication_done: boolean | null
  internal_note: string | null
  needs_follow_up: boolean
}

export function parseCompleteQualityReview(raw: unknown): CompleteQualityReviewInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const note = text(b.internal_note, '內部備註', MAX.NOTE, false) || null
  assertNoPersonalData(note, '內部備註')
  return {
    chk_events_complete: optionalBool(b.chk_events_complete, '服務事件完整性'),
    chk_record_on_time: optionalBool(b.chk_record_on_time, '紀錄準時送審'),
    chk_summary_clear: optionalBool(b.chk_summary_clear, '小結是否清楚'),
    chk_authorization_correct: optionalBool(b.chk_authorization_correct, '授權是否正確'),
    chk_communication_done: optionalBool(b.chk_communication_done, '溝通流程是否完成'),
    internal_note: note,
    needs_follow_up: b.needs_follow_up === true,
  }
}

export interface CreateFollowUpInput {
  action_code: string
  staff_visible_note: string | null
  due_date: string | null
  owner_companion_id: number | null
}

export function parseCreateFollowUp(raw: unknown): CreateFollowUpInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  // 這段文字陪診員看得到，所以個資檢查一定要跑
  const note = text(b.staff_visible_note, '給陪診員的說明', MAX.STAFF_NOTE, false) || null
  assertNoPersonalData(note, '給陪診員的說明')
  const owner = b.owner_companion_id
  return {
    action_code: oneOf(b.action_code, QUALITY_FOLLOW_UP_ACTIONS, '改善項目'),
    staff_visible_note: note,
    due_date: isoDate(b.due_date, '到期日', false) || null,
    owner_companion_id: typeof owner === 'number' && Number.isInteger(owner) && owner > 0 ? owner : null,
  }
}

// ── 政策版本 ────────────────────────────────────────────────
export interface CreatePolicyVersionInput {
  policy_kind: string
  version_label: string
  body_text: string
}

export function parseCreatePolicyVersion(raw: unknown): CreatePolicyVersionInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    policy_kind: oneOf(b.policy_kind, POLICY_KINDS, '文件種類'),
    version_label: text(b.version_label, '版本標籤', MAX.LABEL),
    // 正文由營運與法務貼入，系統不代寫也不檢查法律效力
    body_text: text(b.body_text, '正文', MAX.BODY),
  }
}

// ── 資料生命週期 ────────────────────────────────────────────
export interface CreateLifecycleReviewInput {
  resource_kind: string
  booking_id: number | null
  reason_code: string
  due_date: string | null
  note: string | null
}

export function parseCreateLifecycleReview(raw: unknown): CreateLifecycleReviewInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const note = text(b.note, '備註', 300, false) || null
  assertNoPersonalData(note, '備註')
  const bid = b.booking_id
  return {
    resource_kind: oneOf(b.resource_kind, LIFECYCLE_RESOURCE_KINDS, '資源類型'),
    booking_id: typeof bid === 'number' && Number.isInteger(bid) && bid > 0 ? bid : null,
    reason_code: oneOf(b.reason_code, LIFECYCLE_REASON_CODES, '原因'),
    due_date: isoDate(b.due_date, '到期日', false) || null,
    note,
  }
}

export function parseMarkLifecycleReviewed(raw: unknown): { status: string; note: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  const note = text(b.note, '備註', 300, false) || null
  assertNoPersonalData(note, '備註')
  // 刻意不含 'pending'：標記已審核就不能標回未處理
  return {
    status: oneOf(b.status, ['reviewed', 'retain', 'pending_legal_confirmation'] as const, '處理結果'),
    note,
  }
}
