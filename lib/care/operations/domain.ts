/**
 * Sprint E 營運閉環領域模型 —— 純函式，無 I/O，可直接單元測試。
 *
 * 三件事在這裡定調，其他層只是照做：
 *   1. 通知內容的白名單與長度上限（toNotificationPayload）
 *   2. 外部發送永遠不成立（assertOutboxNeverSent）
 *   3. 家屬看得到什麼，由單筆授權決定，不由身分決定
 */
import { CareRuleError, CareInputError, canTransition, assertTransition } from '../domain'
export { CareRuleError, CareInputError, canTransition, assertTransition }

// ── 通知 ────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  'service_event_published',
  'family_summary_published',
  'family_action_needed',
  'incident_contact_requested',
  'feedback_requested',
  'quality_follow_up_requested',
  'staff_schedule_updated',
  'staff_time_off_reviewed',
  'settlement_published',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_STATUSES = ['unread', 'read', 'archived'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export const NOTIFICATION_TRANSITIONS: Record<NotificationStatus, NotificationStatus[]> = {
  unread: ['read', 'archived'],
  read: ['archived'],
  archived: [],
}

/** 哪些通知是給家屬的，哪些是給陪診員的 —— 不可混用 */
export const FAMILY_NOTIFICATION_TYPES: NotificationType[] = [
  'service_event_published', 'family_summary_published', 'family_action_needed',
  'incident_contact_requested', 'feedback_requested',
]
export const STAFF_NOTIFICATION_TYPES: NotificationType[] = [
  'quality_follow_up_requested', 'staff_schedule_updated',
  'staff_time_off_reviewed', 'settlement_published',
]

export const NOTIFICATION_LIMITS = { TITLE: 60, BODY: 200, LINK: 200 }

/**
 * 通知標題與內文的固定模板。
 *
 * 刻意**不接受**呼叫端傳入自由文字：通知會出現在鎖定畫面、
 * 推播預覽與瀏覽器分頁標題上，任何病況、姓名、電話一旦進去就收不回來。
 * 想讓家屬知道細節，就讓他點進去 —— 那一頁會再做一次授權檢查。
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; body: string }> = {
  service_event_published: { title: '服務有新的進度', body: '您授權查看的服務新增了一則進度紀錄。' },
  family_summary_published: { title: '服務小結已發布', body: '這次的服務小結已經完成，可以查看。' },
  family_action_needed: { title: '有需要您確認的事項', body: '這次服務有需要家屬確認的項目。' },
  incident_contact_requested: { title: '客服想與您聯絡', body: '關於這次服務，我們想與您聯絡確認。' },
  feedback_requested: { title: '想聽聽您的意見', body: '這次服務已完成，方便的話請給我們一些回饋。' },
  quality_follow_up_requested: { title: '有一項服務流程改善事項', body: '請查看待處理的流程改善事項。' },
  staff_schedule_updated: { title: '班表有異動', body: '您的班表或可服務時段有更新。' },
  staff_time_off_reviewed: { title: '請假申請已審核', body: '您的申請已完成審核，請查看結果。' },
  settlement_published: { title: '結算已發布', body: '有新的已發布結算明細可以查看。' },
}

export interface NotificationPayload {
  notification_type: NotificationType
  title: string
  body: string
  link_path: string | null
}

/**
 * 產生通知內容。這是唯一的來源。
 *
 * linkPath 必須是站內相對路徑：外部網址等於把使用者往站外送，
 * 而且無法再做授權檢查。
 */
export function toNotificationPayload(
  type: NotificationType, linkPath?: string | null,
): NotificationPayload {
  const tpl = NOTIFICATION_TEMPLATES[type]
  if (!tpl) throw new CareInputError('不支援的通知類型', 'notification_type')

  let link: string | null = null
  if (linkPath) {
    if (!linkPath.startsWith('/') || linkPath.startsWith('//')) {
      throw new CareInputError('通知連結只能是站內路徑', 'link_path')
    }
    if (linkPath.includes('?') || linkPath.includes('#')) {
      // query string 會進到伺服器 log 與 analytics
      throw new CareInputError('通知連結不可帶參數', 'link_path')
    }
    if (linkPath.length > NOTIFICATION_LIMITS.LINK) {
      throw new CareInputError('通知連結過長', 'link_path')
    }
    link = linkPath
  }

  return {
    notification_type: type,
    title: tpl.title.slice(0, NOTIFICATION_LIMITS.TITLE),
    body: tpl.body.slice(0, NOTIFICATION_LIMITS.BODY),
    link_path: link,
  }
}

/** 收件人身分與通知類型必須相符 */
export function assertRecipientKindMatches(
  type: NotificationType, kind: 'family' | 'staff',
): void {
  const allowed = kind === 'family' ? FAMILY_NOTIFICATION_TYPES : STAFF_NOTIFICATION_TYPES
  if (!allowed.includes(type)) {
    throw new CareRuleError(`通知類型 ${type} 不能寄給${kind === 'family' ? '家屬' : '陪診員'}`)
  }
}

// ── 通知偏好 ────────────────────────────────────────────────
export const NOTIFICATION_CATEGORIES = [
  'service_progress', 'summary_published', 'action_needed',
  'feedback_request', 'quality_follow_up', 'schedule', 'settlement',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const CATEGORY_OF_TYPE: Record<NotificationType, NotificationCategory> = {
  service_event_published: 'service_progress',
  family_summary_published: 'summary_published',
  family_action_needed: 'action_needed',
  incident_contact_requested: 'action_needed',
  feedback_requested: 'feedback_request',
  quality_follow_up_requested: 'quality_follow_up',
  staff_schedule_updated: 'schedule',
  staff_time_off_reviewed: 'schedule',
  settlement_published: 'settlement',
}

/**
 * 服務與安全上必要的站內通知，即使使用者關掉偏好仍會建立。
 * 這不是行銷訊息，關掉它等於讓人漏掉需要處理的事。
 */
export const ESSENTIAL_CATEGORIES: NotificationCategory[] = ['action_needed', 'summary_published']

export function shouldCreateInApp(
  category: NotificationCategory,
  pref: { in_app_enabled: boolean } | null | undefined,
): boolean {
  if (ESSENTIAL_CATEGORIES.includes(category)) return true
  if (!pref) return true // 沒設定過就用預設值：開
  return pref.in_app_enabled
}

// ── Outbox：外部發送本輪一律不成立 ─────────────────────────
export const OUTBOX_CHANNELS = ['in_app', 'external_pending_configuration'] as const
export const OUTBOX_STATUSES = [
  'not_configured', 'queued_for_approved_provider', 'suppressed', 'cancelled',
] as const
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number]

/** 未來接上 provider 前，這個旗標一律 false，而且不從環境變數讀 */
export const EXTERNAL_NOTIFICATION_ENABLED = false

export const OUTBOX_SUPPRESSION_REASONS = [
  'no_provider_configured', 'recipient_not_opted_in',
  'authorization_revoked', 'operations_decision',
] as const

/**
 * 決定一則通知的外部 outbox 狀態。
 *
 * 三個條件缺一不可：provider 已設定、使用者明確 opt-in、授權仍有效。
 * 本輪第一個條件永遠是 false，所以結果永遠是 not_configured。
 */
export function resolveOutboxStatus(input: {
  providerConfigured: boolean
  optedIn: boolean
  authorizationActive: boolean
}): { status: OutboxStatus; reason: string | null } {
  if (!input.providerConfigured) {
    return { status: 'not_configured', reason: 'no_provider_configured' }
  }
  if (!input.authorizationActive) {
    return { status: 'suppressed', reason: 'authorization_revoked' }
  }
  if (!input.optedIn) {
    return { status: 'suppressed', reason: 'recipient_not_opted_in' }
  }
  return { status: 'queued_for_approved_provider', reason: null }
}

/** 任何想把 outbox 標記成已送出的程式碼，都會在這裡被擋下 */
export function assertOutboxNeverSent(status: string): void {
  if (!(OUTBOX_STATUSES as readonly string[]).includes(status)) {
    throw new CareRuleError('沒有已核准的外部通知 provider，不可標記為已送出')
  }
}

// ── 回饋 ────────────────────────────────────────────────────
export const FEEDBACK_REQUEST_STATUSES = [
  'eligible', 'presented', 'completed', 'expired', 'suppressed',
] as const
export type FeedbackRequestStatus = (typeof FEEDBACK_REQUEST_STATUSES)[number]

export const FEEDBACK_REQUEST_TRANSITIONS: Record<FeedbackRequestStatus, FeedbackRequestStatus[]> = {
  // eligible 也可以直接 completed：presented 只是「畫面顯示過了」的紀錄，
  // 不是送出的前提。要求先 presented 會讓合法的送出因為沒記到而失敗。
  eligible: ['presented', 'completed', 'expired', 'suppressed'],
  presented: ['completed', 'expired', 'suppressed'],
  completed: [],
  expired: [],
  suppressed: [],
}

export const FEEDBACK_STATUSES = ['submitted', 'under_review', 'closed'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  submitted: ['under_review', 'closed'],
  under_review: ['closed'],
  closed: [],
}

export const FEEDBACK_SCORE_FIELDS = [
  'score_reassurance', 'score_communication', 'score_process_support',
] as const

/**
 * 什麼時候才可以請家屬給回饋。
 *
 * 三個條件同時成立：服務已完成、小結已發布、這個人對這筆服務有有效授權。
 * 付款人不會因為付了錢就自動 eligible —— 付款不是授權。
 */
export function isFeedbackEligible(input: {
  bookingStatus: string
  summaryPublished: boolean
  hasSummaryAuthorization: boolean
}): boolean {
  return input.bookingStatus === '已完成'
    && input.summaryPublished
    && input.hasSummaryAuthorization
}

export function assertFeedbackEligible(input: {
  bookingStatus: string
  summaryPublished: boolean
  hasSummaryAuthorization: boolean
}): void {
  if (!input.hasSummaryAuthorization) throw new CareRuleError('您沒有這筆服務的閱覽授權')
  if (input.bookingStatus !== '已完成') throw new CareRuleError('服務尚未完成，還不能填寫回饋')
  if (!input.summaryPublished) throw new CareRuleError('服務小結尚未發布，還不能填寫回饋')
}

/** 去識別化平均分：樣本太少就不給數字，否則等於指認個別家庭 */
export const MIN_INSIGHT_SAMPLE = 5

export function averageOrSuppressed(
  values: readonly number[], minSample = MIN_INSIGHT_SAMPLE,
): { value: number | null; suppressed: boolean; sample: number } {
  const n = values.length
  if (n < minSample) return { value: null, suppressed: true, sample: n }
  const avg = values.reduce((a, b) => a + b, 0) / n
  return { value: Math.round(avg * 10) / 10, suppressed: false, sample: n }
}

// ── 意見／申訴 ──────────────────────────────────────────────
export const CONCERN_SOURCES = [
  'family_feedback', 'family_submitted', 'staff_submitted', 'operations_created',
] as const
export const CONCERN_CATEGORIES = [
  'communication', 'schedule', 'handover', 'service_experience',
  'privacy_request', 'other_non_medical',
] as const
export const CONCERN_STATUSES = [
  'open', 'acknowledged', 'in_follow_up', 'resolved', 'closed',
] as const
export type ConcernStatus = (typeof CONCERN_STATUSES)[number]

export const CONCERN_TRANSITIONS: Record<ConcernStatus, ConcernStatus[]> = {
  open: ['acknowledged'],
  acknowledged: ['in_follow_up', 'resolved'],
  in_follow_up: ['resolved'],
  resolved: ['closed'],
  closed: [],
}

export const CONCERN_RESOLUTION_CODES = [
  'explained_to_family', 'process_adjusted', 'staff_coaching',
  'scheduling_fixed', 'no_action_needed', 'referred_to_operations_sop',
] as const

/**
 * 家屬看得到自己案件的什麼。
 *
 * 內部備註、負責人、其他人的資料一律不給 —— 那是內部處理過程，
 * 不是對申訴人的回覆。
 */
export interface ConcernPublicStatus {
  concern_id: number
  category: string
  status: string
  created_at: string
  resolved_at: string | null
  resolution_code: string | null
}

export function toConcernPublicStatus(row: {
  id: number; category: string; status: string
  created_at: string; resolved_at: string | null; resolution_code: string | null
}): ConcernPublicStatus {
  return {
    concern_id: row.id,
    category: row.category,
    status: row.status,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    resolution_code: row.resolution_code,
  }
}

// ── 品質覆核 ────────────────────────────────────────────────
export const QUALITY_REVIEW_STATUSES = [
  'pending', 'in_review', 'completed', 'follow_up_required',
] as const
export type QualityReviewStatus = (typeof QUALITY_REVIEW_STATUSES)[number]

export const QUALITY_REVIEW_TRANSITIONS: Record<QualityReviewStatus, QualityReviewStatus[]> = {
  pending: ['in_review'],
  in_review: ['completed', 'follow_up_required'],
  follow_up_required: ['completed'],
  completed: [],
}

export const QUALITY_CHECKLIST_FIELDS = [
  'chk_events_complete', 'chk_record_on_time', 'chk_summary_clear',
  'chk_authorization_correct', 'chk_communication_done',
] as const

export const QUALITY_FOLLOW_UP_ACTIONS = [
  'record_timeliness', 'event_completeness', 'family_communication',
  'handover_process', 'authorization_handling', 'other_process',
] as const
export const QUALITY_FOLLOW_UP_STATUSES = [
  'open', 'in_progress', 'completed', 'verified', 'cancelled',
] as const
export type QualityFollowUpStatus = (typeof QUALITY_FOLLOW_UP_STATUSES)[number]

export const QUALITY_FOLLOW_UP_TRANSITIONS: Record<QualityFollowUpStatus, QualityFollowUpStatus[]> = {
  open: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified'],
  verified: [],
  cancelled: [],
}

/**
 * 陪診員看得到自己改善任務的什麼。
 *
 * 不含督導的內部備註、不含家屬回饋原文、不含分數、不含其他人的任務。
 * 只有「要改什麼、什麼時候前完成、現在什麼狀態」。
 */
export interface FollowUpStaffView {
  follow_up_id: number
  action_code: string
  note: string | null
  due_date: string | null
  status: string
}

export function toFollowUpStaffView(row: {
  id: number; action_code: string; staff_visible_note: string | null
  due_date: string | null; status: string
}): FollowUpStaffView {
  return {
    follow_up_id: row.id,
    action_code: row.action_code,
    note: row.staff_visible_note,
    due_date: row.due_date,
    status: row.status,
  }
}

// ── 政策版本 ────────────────────────────────────────────────
export const POLICY_KINDS = [
  'terms_of_service', 'privacy_notice', 'cancellation_rules', 'family_handover_notice',
] as const
export type PolicyKind = (typeof POLICY_KINDS)[number]

export const POLICY_STATUSES = ['draft', 'published', 'retired'] as const
export type PolicyStatus = (typeof POLICY_STATUSES)[number]

export const POLICY_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  draft: ['published'],
  published: ['retired'],
  retired: [],
}

/**
 * 接受政策 ≠ 單筆服務授權 ≠ 長期 consent ≠ 外部通知 opt-in。
 * 四件事互相獨立，任一件都不會自動產生另一件。這個函式存在的目的
 * 就是讓「有人想用其中一個推導另一個」時，測試會失敗。
 */
export function policyAcceptanceImpliesNothing(): {
  grantsServiceAuthorization: false
  grantsConsent: false
  grantsExternalOptIn: false
} {
  return {
    grantsServiceAuthorization: false,
    grantsConsent: false,
    grantsExternalOptIn: false,
  }
}

// ── 資料生命週期 ────────────────────────────────────────────
export const LIFECYCLE_RESOURCE_KINDS = [
  'service_record', 'family_summary', 'service_event', 'incident',
  'feedback', 'concern', 'notification', 'settlement_line',
] as const
export const LIFECYCLE_STATUSES = [
  'pending', 'reviewed', 'retain', 'pending_legal_confirmation',
] as const
export const LIFECYCLE_REASON_CODES = [
  'retention_period_review', 'user_request', 'operational_cleanup', 'legal_hold',
] as const

/** 本輪不刪除任何真實資料 —— 這個清單只是待辦，不是刪除工具 */
export const LIFECYCLE_DELETION_ENABLED = false

// ── 上線檢核 ────────────────────────────────────────────────
export type ReadinessState = 'ready' | 'blocked' | 'not_applicable'

export interface ReadinessCheck {
  key: string
  label: string
  state: ReadinessState
  detail: string
  /** true = 要人去做決定，不是寫程式能解決的 */
  manual: boolean
}

/**
 * 上線檢核一律從真實狀態算出來。
 *
 * 沒有「手動打勾說已完成」的路徑 —— 那樣的檢核表只會讓人放心地上線，
 * 然後在正式環境才發現條款還是空的。
 */
export function buildReadinessChecks(facts: {
  migrationsApplied: boolean
  externalNotificationEnabled: boolean
  photoAttachmentEnabled: boolean
  realPaymentEnabled: boolean
  publishedPolicyKinds: readonly string[]
  monitoringProvider: string | null
  companionsWithoutEmployment: number
  companionsWithoutVerifiedCapability: number
  openIncidents: number
  overdueConcerns: number
  broadAccessAdmins: number
}): ReadinessCheck[] {
  const checks: ReadinessCheck[] = []
  const add = (
    key: string, label: string, state: ReadinessState, detail: string, manual = false,
  ) => checks.push({ key, label, state, detail, manual })

  add('migrations', '資料庫 migration 已套用',
    facts.migrationsApplied ? 'ready' : 'blocked',
    facts.migrationsApplied
      ? '本輪所有資料表都查得到'
      : '有資料表尚未建立，請執行 migrations/care_operations_closure_schema.sql')

  add('flag_external_notification', '外部通知預設關閉',
    facts.externalNotificationEnabled ? 'blocked' : 'ready',
    facts.externalNotificationEnabled
      ? '外部通知被打開了，但本輪沒有已核准的 provider'
      : '沒有外部 provider，outbox 一律 not_configured')

  add('flag_photo', '照片／附件預設關閉',
    facts.photoAttachmentEnabled ? 'blocked' : 'ready',
    facts.photoAttachmentEnabled ? '照片授權被打開了' : 'view_service_photo 在資料庫層直接擋下')

  add('flag_payment', '實際付款未啟用',
    facts.realPaymentEnabled ? 'blocked' : 'ready',
    facts.realPaymentEnabled ? '偵測到付款功能被啟用' : '沒有任何金流整合，結算只是內部帳')

  for (const kind of POLICY_KINDS) {
    const published = facts.publishedPolicyKinds.includes(kind)
    add(`policy_${kind}`, `政策文件：${kind}`,
      published ? 'ready' : 'blocked',
      published ? '已有發布版本' : '尚無已發布版本，正文需由營運與法務確認後填入',
      true)
  }

  add('monitoring', '錯誤追蹤／監控',
    facts.monitoringProvider ? 'ready' : 'blocked',
    facts.monitoringProvider
      ? `已設定：${facts.monitoringProvider}`
      : '未設定監控 provider（不會假裝已啟用）',
    true)

  add('staff_employment', '陪診員都有有效僱用條件',
    facts.companionsWithoutEmployment === 0 ? 'ready' : 'blocked',
    facts.companionsWithoutEmployment === 0
      ? '全部都有'
      : `${facts.companionsWithoutEmployment} 位沒有僱用條件，派工時會一律不合格`)

  add('staff_capability', '陪診員都有已驗證的必要能力',
    facts.companionsWithoutVerifiedCapability === 0 ? 'ready' : 'blocked',
    facts.companionsWithoutVerifiedCapability === 0
      ? '全部都有'
      : `${facts.companionsWithoutVerifiedCapability} 位尚未驗證一般門診流程，派工時選不到`)

  add('broad_access', '沒有過寬的後台權限',
    facts.broadAccessAdmins <= 1 ? 'ready' : 'blocked',
    facts.broadAccessAdmins <= 1
      ? '超級管理員數量合理'
      : `有 ${facts.broadAccessAdmins} 個帳號握有全部權限，請改為分權`)

  add('backlog_incident', '沒有積壓的異常事件',
    facts.openIncidents === 0 ? 'ready' : 'blocked',
    facts.openIncidents === 0 ? '目前沒有未結案異常' : `${facts.openIncidents} 件未結案`)

  add('backlog_concern', '沒有逾期的意見案件',
    facts.overdueConcerns === 0 ? 'ready' : 'blocked',
    facts.overdueConcerns === 0 ? '目前沒有逾期案件' : `${facts.overdueConcerns} 件已逾期`)

  // 純人工待決：程式無從判斷，一律標為 blocked 而不是 ready
  const manualItems: [string, string][] = [
    ['manual_retention', '資料保留與刪除政策已確認'],
    ['manual_insurance', '服務責任與保險已確認'],
    ['manual_incident_sop', '異常升級 SOP 與聯絡人已確認'],
    ['manual_feedback_sla', '回饋與申訴處理時效已確認'],
    ['manual_settlement_rule', '結算規則與人員報酬模型已確認'],
    ['manual_external_channel', '外部通知通道與 opt-in 文案已確認'],
  ]
  for (const [key, label] of manualItems) {
    add(key, label, 'blocked', '需由營運／法務／財務確認後才可上線', true)
  }

  return checks
}

export function summarizeReadiness(checks: readonly ReadinessCheck[]): {
  ready: number; blocked: number; notApplicable: number; manualBlocked: number; overall: ReadinessState
} {
  const ready = checks.filter(c => c.state === 'ready').length
  const blocked = checks.filter(c => c.state === 'blocked').length
  const notApplicable = checks.filter(c => c.state === 'not_applicable').length
  const manualBlocked = checks.filter(c => c.state === 'blocked' && c.manual).length
  return { ready, blocked, notApplicable, manualBlocked, overall: blocked === 0 ? 'ready' : 'blocked' }
}

// ── 權限 ────────────────────────────────────────────────────
export const CLOSURE_PERMISSION_KEYS = {
  notification: 'care_notification.manage',
  qualityReview: 'care_quality.review',
  qualityManage: 'care_quality.manage',
  feedback: 'care_feedback.manage',
  concern: 'care_concern.manage',
  insights: 'care_insights.view',
  releaseReadiness: 'care_release_readiness.view',
  policy: 'care_policy.manage',
  lifecycle: 'care_data_lifecycle.manage',
} as const

export const ALL_CLOSURE_PERMISSIONS: string[] = Object.values(CLOSURE_PERMISSION_KEYS)

/**
 * 營運控制台的讀取權限。
 *
 * 刻意**排除** care_settlement.manage 與 care_data_lifecycle.manage：
 * 前者是財務（Sprint D 已經修過一次同樣的洞），
 * 後者是個資處理，兩者都不該因為在同一個 portal 就讀到品質與家屬意見。
 */
export const OPERATIONS_READ_PERMISSIONS: string[] = [
  'care_operations.view',
  CLOSURE_PERMISSION_KEYS.notification,
  CLOSURE_PERMISSION_KEYS.qualityReview,
  CLOSURE_PERMISSION_KEYS.qualityManage,
  CLOSURE_PERMISSION_KEYS.feedback,
  CLOSURE_PERMISSION_KEYS.concern,
]

/** 家屬與陪診員本人的能力：登入即有，不由後台角色調整 */
export const OWN_SCOPE_CAPABILITIES = {
  readOwnNotification: 'care_notification.read_own',
  submitOwnFeedback: 'care_feedback.submit_own_authorized_order',
} as const
