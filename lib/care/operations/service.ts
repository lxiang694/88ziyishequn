/**
 * Sprint E 營運閉環 Service —— 固定用例，沒有泛用更新。
 *
 * 三條規則貫穿整個檔案：
 *   1. 家屬看得到什麼，由單筆授權決定，不由「他是誰」決定。
 *   2. 通知內容來自固定模板，呼叫端不能塞自由文字。
 *   3. 外部發送在本輪永遠不成立，而且不是靠前端不顯示按鈕。
 */
import * as repo from './repository'
import {
  CareRuleError, CareInputError, assertTransition,
  NOTIFICATION_TRANSITIONS, CATEGORY_OF_TYPE, toNotificationPayload,
  assertRecipientKindMatches, shouldCreateInApp,
  resolveOutboxStatus, EXTERNAL_NOTIFICATION_ENABLED,
  FEEDBACK_REQUEST_TRANSITIONS, FEEDBACK_TRANSITIONS,
  assertFeedbackEligible, averageOrSuppressed,
  CONCERN_TRANSITIONS, toConcernPublicStatus,
  QUALITY_REVIEW_TRANSITIONS, QUALITY_FOLLOW_UP_TRANSITIONS, toFollowUpStaffView,
  POLICY_TRANSITIONS, buildReadinessChecks, summarizeReadiness,
  LIFECYCLE_DELETION_ENABLED,
  type NotificationType, type NotificationStatus,
  type FeedbackRequestStatus, type FeedbackStatus,
  type ConcernStatus, type QualityReviewStatus, type QualityFollowUpStatus,
  type PolicyStatus,
} from './domain'
import type {
  NotificationPreferenceInput, SubmitFeedbackInput, CreateConcernInput,
  CompleteQualityReviewInput, CreateFollowUpInput, CreatePolicyVersionInput,
  CreateLifecycleReviewInput,
} from './validation'

export interface ActorAdmin { id: number; name: string; account?: string }
export interface ActorFamily { userId: string }
export interface ActorStaff { id: number; name: string }

function today(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
}

// ══ 通知 ═══════════════════════════════════════════════════

/**
 * 建立站內通知。
 *
 * 收件人由資源關係推出，不由呼叫端指定 —— 否則任何有這個權限的人
 * 都可以把通知寄給任意使用者。
 */
export async function createInAppCareNotification(
  input: {
    type: NotificationType
    bookingId: number | null
    linkPath?: string | null
    recipient: { kind: 'family'; userId: string } | { kind: 'staff'; companionId: number }
  },
  actor: ActorAdmin | null,
): Promise<{ notificationId: number | null; skipped: string | null }> {
  assertRecipientKindMatches(input.type, input.recipient.kind)
  const payload = toNotificationPayload(input.type, input.linkPath ?? null)
  const category = CATEGORY_OF_TYPE[input.type]

  // 家屬：授權失效就不再建立新通知
  let authorizationActive = true
  if (input.recipient.kind === 'family') {
    if (input.bookingId === null) throw new CareRuleError('家屬通知必須對應一筆服務')
    const auths = await repo.listActiveAuthorizations(input.recipient.userId, input.bookingId)
    authorizationActive = auths.length > 0
    if (!authorizationActive) {
      return { notificationId: null, skipped: 'authorization_revoked' }
    }
  }

  // 偏好：必要類別不受偏好影響，其餘尊重使用者設定
  const prefs = input.recipient.kind === 'family'
    ? await repo.listPreferencesForUser(input.recipient.userId)
    : await repo.listPreferencesForCompanion(input.recipient.companionId)
  const pref = prefs.find(p => p.category === category) || null
  if (!shouldCreateInApp(category, pref)) {
    return { notificationId: null, skipped: 'user_disabled_category' }
  }

  const row = await repo.insertNotification({
    recipient_user_id: input.recipient.kind === 'family' ? input.recipient.userId : null,
    recipient_companion_id: input.recipient.kind === 'staff' ? input.recipient.companionId : null,
    booking_id: input.bookingId,
    notification_type: input.type,
    title: payload.title,
    body: payload.body,
    link_path: payload.link_path,
    created_by_admin_id: actor?.id ?? null,
    source_reference: null,
  })

  // Outbox：本輪 providerConfigured 恆為 false，所以一定是 not_configured
  const outcome = resolveOutboxStatus({
    providerConfigured: EXTERNAL_NOTIFICATION_ENABLED,
    optedIn: pref?.external_channel_opt_in === true,
    authorizationActive,
  })
  await repo.insertOutbox({
    notification_id: row.id,
    channel: 'external_pending_configuration',
    status: outcome.status,
    suppression_reason_code: outcome.reason,
  })

  return { notificationId: row.id, skipped: null }
}

export async function listOwnFamilyNotifications(actor: ActorFamily) {
  const rows = await repo.listNotificationsForUser(actor.userId)
  return rows.map(r => ({
    id: r.id, type: r.notification_type, status: r.status,
    title: r.title, body: r.body, link_path: r.link_path, created_at: r.created_at,
  }))
}

export async function listOwnStaffNotifications(actor: ActorStaff) {
  const rows = await repo.listNotificationsForCompanion(actor.id)
  return rows.map(r => ({
    id: r.id, type: r.notification_type, status: r.status,
    title: r.title, body: r.body, link_path: r.link_path, created_at: r.created_at,
  }))
}

/** 只能標記自己的通知；別人的一律當作不存在 */
export async function markOwnCareNotificationRead(
  notificationId: number,
  owner: { kind: 'family'; userId: string } | { kind: 'staff'; companionId: number },
  nextStatus: NotificationStatus = 'read',
): Promise<void> {
  const n = await repo.getNotification(notificationId)
  if (!n) throw new CareRuleError('找不到這則通知')

  const isOwner = owner.kind === 'family'
    ? n.recipient_user_id === owner.userId
    : n.recipient_companion_id === owner.companionId
  // 不透露這則通知是否存在
  if (!isOwner) throw new CareRuleError('找不到這則通知')

  assertTransition(NOTIFICATION_TRANSITIONS, n.status as NotificationStatus, nextStatus, '通知')
  await repo.updateNotificationStatus(notificationId, nextStatus)
}

export async function updateOwnCareNotificationPreference(
  input: NotificationPreferenceInput,
  owner: { kind: 'family'; userId: string } | { kind: 'staff'; companionId: number },
): Promise<void> {
  await repo.upsertPreference({
    user_id: owner.kind === 'family' ? owner.userId : null,
    companion_id: owner.kind === 'staff' ? owner.companionId : null,
    category: input.category,
    in_app_enabled: input.in_app_enabled,
  })
}

export async function listOwnNotificationPreferences(
  owner: { kind: 'family'; userId: string } | { kind: 'staff'; companionId: number },
) {
  const rows = owner.kind === 'family'
    ? await repo.listPreferencesForUser(owner.userId)
    : await repo.listPreferencesForCompanion(owner.companionId)
  return rows.map(r => ({
    category: r.category,
    in_app_enabled: r.in_app_enabled,
    // 外部通道狀態一律回傳，但本輪必定是 not_configured
    external_channel_state: r.external_channel_state,
  }))
}

export async function suppressCareNotificationOutboxItem(
  outboxId: number, reasonCode: string, actor: ActorAdmin,
): Promise<void> {
  await repo.suppressOutbox(outboxId, reasonCode, actor.id)
}

export async function getNotificationAdminView() {
  const [items, outbox, counts] = await Promise.all([
    repo.listNotificationMetadata(100),
    repo.listOutbox(100),
    repo.countOutboxByStatus(),
  ])
  return {
    // 後台只看得到 metadata，看不到每則通知的內文
    items,
    outbox,
    outbox_counts: counts,
    external_enabled: EXTERNAL_NOTIFICATION_ENABLED,
  }
}

// ══ 回饋 ═══════════════════════════════════════════════════

/**
 * 建立回饋邀請。
 *
 * 三個條件都要成立才會建立：服務已完成、小結已發布、
 * 這個人對這筆服務有 view_service_summary 授權。
 * 付款人身分不算 —— 付款不是授權。
 */
export async function createAuthorizedCareFeedbackRequest(
  bookingId: number, recipientUserId: string, actor: ActorAdmin,
): Promise<{ requestId: number; created: boolean }> {
  const booking = await repo.getBookingBasics(bookingId)
  if (!booking) throw new CareRuleError('找不到這筆服務')

  const auths = await repo.listActiveAuthorizations(recipientUserId, bookingId)
  const canSummary = auths.some(a => a.scope === 'view_service_summary')
  const summaryId = await repo.getPublishedSummaryId(bookingId)

  assertFeedbackEligible({
    bookingStatus: booking.status,
    summaryPublished: summaryId !== null,
    hasSummaryAuthorization: canSummary,
  })

  const existing = await repo.findFeedbackRequest(bookingId, recipientUserId)
  if (existing) return { requestId: existing.id, created: false }

  try {
    const row = await repo.insertFeedbackRequest({
      booking_id: bookingId,
      recipient_user_id: recipientUserId,
      summary_id: summaryId,
      expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    })
    // 邀請本身也是一則站內通知
    await createInAppCareNotification({
      type: 'feedback_requested', bookingId,
      linkPath: `/care/booking/${bookingId}`,
      recipient: { kind: 'family', userId: recipientUserId },
    }, actor)
    return { requestId: row.id, created: true }
  } catch (e) {
    // 並發：另一個請求剛好也建了同一張邀請
    if (repo.isUniqueViolation(e)) {
      const again = await repo.findFeedbackRequest(bookingId, recipientUserId)
      if (again) return { requestId: again.id, created: false }
    }
    throw e
  }
}

export async function listOwnFeedbackRequests(actor: ActorFamily) {
  const rows = await repo.listFeedbackRequestsForUser(actor.userId)
  return rows.map(r => ({
    request_id: r.id, booking_id: r.booking_id,
    status: r.status, expires_at: r.expires_at,
  }))
}

/** 一張邀請只收一份回饋；重試與並發都不會產生第二筆 */
export async function submitOwnAuthorizedCareFeedback(
  requestId: number, input: SubmitFeedbackInput, actor: ActorFamily,
): Promise<{ feedbackId: number; alreadySubmitted: boolean }> {
  const req = await repo.getFeedbackRequest(requestId)
  if (!req) throw new CareRuleError('找不到這張回饋邀請')
  if (req.recipient_user_id !== actor.userId) throw new CareRuleError('找不到這張回饋邀請')

  // 授權在這一刻仍必須有效
  const auths = await repo.listActiveAuthorizations(actor.userId, req.booking_id)
  if (!auths.some(a => a.scope === 'view_service_summary')) {
    throw new CareRuleError('您已沒有這筆服務的閱覽授權')
  }

  const existing = await repo.getFeedbackByRequest(requestId)
  if (existing) return { feedbackId: existing.id, alreadySubmitted: true }

  if (req.status === 'completed') throw new CareRuleError('這份回饋已經送出過了')
  if (req.status === 'expired' || req.status === 'suppressed') {
    throw new CareRuleError('這張回饋邀請已失效')
  }

  try {
    const row = await repo.insertFeedback({
      request_id: requestId,
      booking_id: req.booking_id,
      submitted_by_user_id: actor.userId,
      score_reassurance: input.score_reassurance,
      score_communication: input.score_communication,
      score_process_support: input.score_process_support,
      comment: input.comment,
    })
    assertTransition(
      FEEDBACK_REQUEST_TRANSITIONS, req.status as FeedbackRequestStatus, 'completed', '回饋邀請')
    await repo.updateFeedbackRequestStatus(requestId, 'completed')
    return { feedbackId: row.id, alreadySubmitted: false }
  } catch (e) {
    if (repo.isUniqueViolation(e)) {
      const again = await repo.getFeedbackByRequest(requestId)
      if (again) return { feedbackId: again.id, alreadySubmitted: true }
    }
    throw e
  }
}

export async function listFeedbackForReview() {
  const rows = await repo.listFeedback(100)
  return rows.map(r => ({
    id: r.id, booking_id: r.booking_id, status: r.status, created_at: r.created_at,
    score_reassurance: r.score_reassurance,
    score_communication: r.score_communication,
    score_process_support: r.score_process_support,
    comment: r.comment,
  }))
}

export async function reviewCareFeedback(
  feedbackId: number, next: FeedbackStatus, actor: ActorAdmin,
): Promise<void> {
  const rows = await repo.listFeedback(500)
  const f = rows.find(r => r.id === feedbackId)
  if (!f) throw new CareRuleError('找不到這份回饋')
  assertTransition(FEEDBACK_TRANSITIONS, f.status as FeedbackStatus, next, '回饋')
  await repo.updateFeedbackStatus(feedbackId, next, actor.id)
}

// ══ 意見／申訴 ═════════════════════════════════════════════

export async function createOwnFamilyConcern(
  bookingId: number, input: CreateConcernInput, actor: ActorFamily,
): Promise<{ concernId: number }> {
  const auths = await repo.listActiveAuthorizations(actor.userId, bookingId)
  if (auths.length === 0) throw new CareRuleError('您沒有這筆服務的授權')

  const row = await repo.insertConcern({
    booking_id: bookingId,
    source: 'family_submitted',
    source_user_id: actor.userId,
    category: input.category,
    description: input.description,
  })
  return { concernId: row.id }
}

export async function createOwnStaffConcern(
  bookingId: number, input: CreateConcernInput, actor: ActorStaff,
): Promise<{ concernId: number }> {
  const booking = await repo.getBookingBasics(bookingId)
  if (!booking) throw new CareRuleError('找不到這筆服務')
  if (booking.companion_id !== actor.id) throw new CareRuleError('這不是您的服務')

  const row = await repo.insertConcern({
    booking_id: bookingId,
    source: 'staff_submitted',
    source_companion_id: actor.id,
    category: input.category,
    description: input.description,
  })
  return { concernId: row.id }
}

/** 營運自行建立的案件（例如電話裡聽到的意見） */
export async function createOperationsConcern(
  bookingId: number | null, input: CreateConcernInput & { source?: string }, actor: ActorAdmin,
): Promise<{ concernId: number }> {
  if (bookingId !== null) {
    const booking = await repo.getBookingBasics(bookingId)
    if (!booking) throw new CareRuleError('找不到這筆服務')
  }
  const row = await repo.insertConcern({
    booking_id: bookingId,
    source: input.source || 'operations_created',
    category: input.category,
    description: input.description,
  })
  return { concernId: row.id }
}

export async function acknowledgeCareConcern(concernId: number, actor: ActorAdmin): Promise<void> {
  const c = await repo.getConcern(concernId)
  if (!c) throw new CareRuleError('找不到這個案件')
  assertTransition(CONCERN_TRANSITIONS, c.status as ConcernStatus, 'acknowledged', '意見案件')
  await repo.updateConcern(concernId, {
    status: 'acknowledged', acknowledged_at: new Date().toISOString(),
    owner_admin_id: c.owner_admin_id ?? actor.id,
  })
}

export async function assignCareConcernOwner(
  concernId: number, ownerAdminId: number, dueDate: string | null, actor: ActorAdmin,
): Promise<void> {
  const c = await repo.getConcern(concernId)
  if (!c) throw new CareRuleError('找不到這個案件')
  if (c.status === 'closed') throw new CareRuleError('已結案的案件不可再指派')
  await repo.updateConcern(concernId, { owner_admin_id: ownerAdminId, due_date: dueDate })
}

export async function resolveCareConcern(
  concernId: number, resolutionCode: string, internalNote: string | null, actor: ActorAdmin,
): Promise<void> {
  const c = await repo.getConcern(concernId)
  if (!c) throw new CareRuleError('找不到這個案件')
  assertTransition(CONCERN_TRANSITIONS, c.status as ConcernStatus, 'resolved', '意見案件')
  await repo.updateConcern(concernId, {
    status: 'resolved', resolution_code: resolutionCode,
    internal_note: internalNote, resolved_at: new Date().toISOString(),
  })
}

export async function closeCareConcern(concernId: number, actor: ActorAdmin): Promise<void> {
  const c = await repo.getConcern(concernId)
  if (!c) throw new CareRuleError('找不到這個案件')
  assertTransition(CONCERN_TRANSITIONS, c.status as ConcernStatus, 'closed', '意見案件')
  await repo.updateConcern(concernId, { status: 'closed', closed_at: new Date().toISOString() })
}

export async function listConcernsForAdmin(status?: string) {
  return repo.listConcerns(status)
}

/** 提出者只看得到自己案件的最小狀態，看不到內部備註與負責人 */
export async function listOwnConcernStatuses(actor: ActorFamily) {
  const rows = await repo.listConcernsForUser(actor.userId)
  return rows.map(toConcernPublicStatus)
}

// ══ 品質覆核 ═══════════════════════════════════════════════

export async function createCareQualityReview(
  bookingId: number, actor: ActorAdmin,
): Promise<{ reviewId: number; created: boolean }> {
  const booking = await repo.getBookingBasics(bookingId)
  if (!booking) throw new CareRuleError('找不到這筆服務')

  const existing = await repo.findQualityReviewByBooking(bookingId)
  if (existing) return { reviewId: existing.id, created: false }

  try {
    const row = await repo.insertQualityReview({ booking_id: bookingId, reviewer_admin_id: actor.id })
    return { reviewId: row.id, created: true }
  } catch (e) {
    if (repo.isUniqueViolation(e)) {
      const again = await repo.findQualityReviewByBooking(bookingId)
      if (again) return { reviewId: again.id, created: false }
    }
    throw e
  }
}

export async function startCareQualityReview(reviewId: number, actor: ActorAdmin): Promise<void> {
  const r = await repo.getQualityReview(reviewId)
  if (!r) throw new CareRuleError('找不到這份品質覆核')
  assertTransition(QUALITY_REVIEW_TRANSITIONS, r.status as QualityReviewStatus, 'in_review', '品質覆核')
  await repo.updateQualityReview(reviewId, {
    status: 'in_review', started_at: new Date().toISOString(), reviewer_admin_id: actor.id,
  })
}

export async function completeCareQualityReview(
  reviewId: number, input: CompleteQualityReviewInput, actor: ActorAdmin,
): Promise<void> {
  const r = await repo.getQualityReview(reviewId)
  if (!r) throw new CareRuleError('找不到這份品質覆核')
  const next: QualityReviewStatus = input.needs_follow_up ? 'follow_up_required' : 'completed'
  assertTransition(QUALITY_REVIEW_TRANSITIONS, r.status as QualityReviewStatus, next, '品質覆核')
  await repo.updateQualityReview(reviewId, {
    status: next,
    chk_events_complete: input.chk_events_complete,
    chk_record_on_time: input.chk_record_on_time,
    chk_summary_clear: input.chk_summary_clear,
    chk_authorization_correct: input.chk_authorization_correct,
    chk_communication_done: input.chk_communication_done,
    internal_note: input.internal_note,
    completed_at: new Date().toISOString(),
    reviewer_admin_id: actor.id,
  })
}

export async function createCareQualityFollowUp(
  reviewId: number, input: CreateFollowUpInput, actor: ActorAdmin,
): Promise<{ followUpId: number }> {
  const r = await repo.getQualityReview(reviewId)
  if (!r) throw new CareRuleError('找不到這份品質覆核')

  const row = await repo.insertFollowUp({
    review_id: reviewId,
    owner_companion_id: input.owner_companion_id,
    owner_admin_id: input.owner_companion_id ? null : actor.id,
    action_code: input.action_code,
    staff_visible_note: input.staff_visible_note,
    due_date: input.due_date,
  })

  // 指派給陪診員時同時發一則站內通知；內容是固定模板
  if (input.owner_companion_id) {
    await createInAppCareNotification({
      type: 'quality_follow_up_requested', bookingId: r.booking_id,
      linkPath: '/companion',
      recipient: { kind: 'staff', companionId: input.owner_companion_id },
    }, actor)
  }
  return { followUpId: row.id }
}

export async function completeCareQualityFollowUp(
  followUpId: number, actor: ActorAdmin | ActorStaff, asStaff: boolean,
): Promise<void> {
  const f = await repo.getFollowUp(followUpId)
  if (!f) throw new CareRuleError('找不到這項改善事項')
  // 陪診員只能完成自己的
  if (asStaff && f.owner_companion_id !== (actor as ActorStaff).id) {
    throw new CareRuleError('找不到這項改善事項')
  }
  assertTransition(
    QUALITY_FOLLOW_UP_TRANSITIONS, f.status as QualityFollowUpStatus, 'completed', '改善事項')
  await repo.updateFollowUp(followUpId, {
    status: 'completed', completed_at: new Date().toISOString(),
  })
}

export async function verifyCareQualityFollowUp(followUpId: number, actor: ActorAdmin): Promise<void> {
  const f = await repo.getFollowUp(followUpId)
  if (!f) throw new CareRuleError('找不到這項改善事項')
  assertTransition(
    QUALITY_FOLLOW_UP_TRANSITIONS, f.status as QualityFollowUpStatus, 'verified', '改善事項')
  await repo.updateFollowUp(followUpId, {
    status: 'verified', verified_at: new Date().toISOString(), verified_by_admin_id: actor.id,
  })
}

/** 陪診員只看得到自己的改善事項摘要，不含督導備註與家屬原文 */
export async function listOwnQualityFollowUps(actor: ActorStaff) {
  const rows = await repo.listFollowUpsForCompanion(actor.id)
  return rows.map(toFollowUpStaffView)
}

export async function getQualityAdminView(status?: string) {
  const [reviews, followUps] = await Promise.all([
    repo.listQualityReviews(status),
    repo.listFollowUps(),
  ])
  return { reviews, follow_ups: followUps }
}

// ══ 政策版本 ═══════════════════════════════════════════════

export async function listCarePolicyVersions() {
  return repo.listPolicyVersions()
}

export async function createCarePolicyVersionDraft(
  input: CreatePolicyVersionInput, actor: ActorAdmin,
): Promise<{ policyVersionId: number }> {
  const row = await repo.insertPolicyVersion({
    policy_kind: input.policy_kind,
    version_label: input.version_label,
    body_text: input.body_text,
    created_by_admin_id: actor.id,
  })
  return { policyVersionId: row.id }
}

export async function publishCarePolicyVersion(
  policyVersionId: number, actor: ActorAdmin,
): Promise<void> {
  const p = await repo.getPolicyVersion(policyVersionId)
  if (!p) throw new CareRuleError('找不到這個政策版本')
  assertTransition(POLICY_TRANSITIONS, p.status as PolicyStatus, 'published', '政策版本')
  if (!p.body_text || !p.body_text.trim()) {
    throw new CareRuleError('正文是空的，不可發布。條款內容需由營運與法務確認後填入。')
  }
  // 同一種文件同時只能有一個已發布版本
  await repo.retirePublishedPolicy(p.policy_kind)
  await repo.publishPolicyVersion(policyVersionId, actor.id)
}

/**
 * 接受政策。
 *
 * 這件事**不會**產生單筆服務授權、不會產生 consent、
 * 也不會產生外部通知 opt-in。有測試鎖住這個行為。
 */
export async function acceptCarePolicyVersion(
  policyVersionId: number,
  subject: { kind: 'family'; userId: string } | { kind: 'staff'; companionId: number },
  bookingId: number | null,
): Promise<{ accepted: boolean }> {
  const p = await repo.getPolicyVersion(policyVersionId)
  if (!p) throw new CareRuleError('找不到這個政策版本')
  if (p.status !== 'published') throw new CareRuleError('只能接受已發布的版本')

  try {
    await repo.insertPolicyAcceptance({
      policy_version_id: policyVersionId,
      user_id: subject.kind === 'family' ? subject.userId : null,
      companion_id: subject.kind === 'staff' ? subject.companionId : null,
      booking_id: bookingId,
    })
    return { accepted: true }
  } catch (e) {
    // 已接受過就是已接受過，重複點不算錯
    if (repo.isUniqueViolation(e)) return { accepted: false }
    throw e
  }
}

// ══ 資料生命週期 ═══════════════════════════════════════════

export async function createCareDataLifecycleReview(
  input: CreateLifecycleReviewInput, actor: ActorAdmin,
): Promise<{ reviewId: number }> {
  const row = await repo.insertLifecycleReview({
    resource_kind: input.resource_kind,
    booking_id: input.booking_id,
    reason_code: input.reason_code,
    due_date: input.due_date,
    note: input.note,
  })
  return { reviewId: row.id }
}

export async function markCareDataLifecycleReviewed(
  reviewId: number, status: string, note: string | null, actor: ActorAdmin,
): Promise<void> {
  // 這個清單不會刪除任何資料 —— 真正的刪除要等法務與備份策略確認後另做
  if (LIFECYCLE_DELETION_ENABLED) throw new CareRuleError('刪除功能本輪未實作')
  await repo.updateLifecycleReview(reviewId, status, note, actor.id)
}

export async function listCareDataLifecycleReviews() {
  return repo.listLifecycleReviews()
}

// ══ 營運控制台與指標 ═══════════════════════════════════════

export async function getCareOperationsQueue() {
  return repo.getOperationsQueueCounts()
}

/**
 * 去識別化 KPI。
 *
 * 全部從真實資料算，沒有任何假數字。樣本數不足時回傳
 * suppressed 而不是一個看起來很漂亮但可以反推到個別家庭的平均分。
 */
export async function getCareInsights() {
  const [counts, scores] = await Promise.all([
    repo.getInsightCounts(),
    repo.listFeedbackScores().catch(() => []),
  ])

  const reassurance = averageOrSuppressed(scores.map(s => s.score_reassurance))
  const communication = averageOrSuppressed(scores.map(s => s.score_communication))
  const processSupport = averageOrSuppressed(scores.map(s => s.score_process_support))

  const feedbackRate = counts.feedback_requests > 0
    ? Math.round((counts.feedback_submitted / counts.feedback_requests) * 1000) / 10
    : null

  return {
    counts,
    feedback_completion_rate: feedbackRate,
    scores: { reassurance, communication, process_support: processSupport },
    min_sample: 5,
    // 沒有資料就是沒有資料，前端顯示 empty state
    has_data: counts.bookings_total > 0,
  }
}

// ══ 上線檢核 ═══════════════════════════════════════════════

const REQUIRED_TABLES = [
  'care_notifications', 'care_notification_preferences', 'care_notification_outbox',
  'care_feedback_requests', 'care_feedback', 'care_concerns',
  'care_quality_reviews', 'care_quality_follow_ups',
  'care_policy_versions', 'care_policy_acceptances', 'care_data_lifecycle_reviews',
]

export async function getCareReleaseReadiness() {
  const existence = await Promise.all(REQUIRED_TABLES.map(t => repo.tableExists(t)))
  const migrationsApplied = existence.every(Boolean)

  // 資料表還沒建立時，後面的查詢會失敗；此時只回報 migration 這一項
  if (!migrationsApplied) {
    const checks = buildReadinessChecks({
      migrationsApplied: false,
      externalNotificationEnabled: EXTERNAL_NOTIFICATION_ENABLED,
      photoAttachmentEnabled: false,
      realPaymentEnabled: false,
      publishedPolicyKinds: [],
      monitoringProvider: null,
      companionsWithoutEmployment: 0,
      companionsWithoutVerifiedCapability: 0,
      openIncidents: 0,
      overdueConcerns: 0,
      broadAccessAdmins: 0,
    })
    return { checks, summary: summarizeReadiness(checks), migrations_applied: false }
  }

  const [publishedKinds, staffGaps, broadAccess, queue, overdue] = await Promise.all([
    repo.listPublishedPolicyKinds(),
    repo.countStaffReadinessGaps().catch(() => ({ withoutEmployment: 0, withoutCapability: 0 })),
    repo.countBroadAccessAdmins().catch(() => 0),
    repo.getOperationsQueueCounts(),
    repo.countOverdueConcerns(today()).catch(() => 0),
  ])

  const checks = buildReadinessChecks({
    migrationsApplied: true,
    externalNotificationEnabled: EXTERNAL_NOTIFICATION_ENABLED,
    // Sprint D 在資料庫層擋下 view_service_photo，所以這裡恆為 false
    photoAttachmentEnabled: false,
    realPaymentEnabled: false,
    publishedPolicyKinds: publishedKinds,
    // 沒有接上任何監控 provider 就誠實回報 null，不假裝已啟用
    monitoringProvider: null,
    companionsWithoutEmployment: staffGaps.withoutEmployment,
    companionsWithoutVerifiedCapability: staffGaps.withoutCapability,
    openIncidents: queue.open_incidents,
    overdueConcerns: overdue,
    broadAccessAdmins: broadAccess,
  })

  return { checks, summary: summarizeReadiness(checks), migrations_applied: true }
}
