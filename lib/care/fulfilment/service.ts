/**
 * Sprint D 履約 Service —— 固定 use case，沒有泛用 PATCH。
 *
 * 每個 action 自己檢查：資源歸屬、狀態轉換、內容守門。
 * 資料庫 trigger 是第二道防線。時間與 actor 一律由伺服器決定。
 */
import {
  RECORD_TRANSITIONS, SUMMARY_TRANSITIONS, INCIDENT_TRANSITIONS,
  LINE_TRANSITIONS, BATCH_TRANSITIONS,
  assertTransition, assertNotificationTransition, assertScopeEnabled,
  assertPartTimeForSettlement, isRecordStaffEditable, mayEverBeFamilyVisible,
  hasServiceAuthorization, CareRuleError, CareInputError,
  type ServiceEventType, type RecordStatus, type SummaryStatus,
  type IncidentStatus, type LineStatus, type BatchStatus,
  type NotificationStatus, type AuthorizationScope,
} from './domain'
import * as repo from './repository'
import type {
  AppendEventInput, RecordDraftInput, SummaryDraftInput,
  IncidentInput, ManualLineInput,
} from './validation'

export interface ActorAdmin { id: number; name: string; account: string }
export interface ActorCompanion { id: number; name: string }

/** 服務進行中才可以記錄；已完成仍可補紀錄與小結 */
const IN_SERVICE_STATUSES = ['已派工', '服務中']
const RECORDABLE_STATUSES = ['已派工', '服務中', '已完成']

// ── 共用歸屬檢查 ────────────────────────────────────────────
/**
 * 陪診員只能碰「指派給自己」的服務。
 * 這是所有 staff action 的第一道門，不靠前端隱藏按鈕。
 */
async function loadOwnBooking(bookingId: number, companionId: number) {
  const b = await repo.getBooking(bookingId)
  if (!b) throw new CareRuleError('找不到這筆服務')
  if (b.companion_id !== companionId) {
    throw new CareRuleError('這不是指派給您的服務')
  }
  return b
}

async function loadBookingOrThrow(bookingId: number) {
  const b = await repo.getBooking(bookingId)
  if (!b) throw new CareRuleError('找不到這筆服務')
  return b
}

// ══════════ 1. 服務事件 ══════════
export async function appendOwnCareServiceEvent(
  bookingId: number, input: AppendEventInput, actor: ActorCompanion,
) {
  const b = await loadOwnBooking(bookingId, actor.id)
  if (!IN_SERVICE_STATUSES.includes(b.status)) {
    throw new CareRuleError(`服務狀態為「${b.status}」，目前不能記錄服務事件`)
  }

  // 時間、可見性、身分都由伺服器決定；事件一律先進內部
  const row = await repo.insertServiceEvent({
    booking_id: bookingId,
    companion_id: actor.id,
    event_type: input.event_type,
    family_note: input.family_note,
    visibility: 'internal',
  })
  return { eventId: row.id, eventType: row.event_type }
}

/** 不刪除，只留作廢痕跡 */
export async function invalidateOwnCareServiceEvent(
  eventId: number, reasonCode: string, actor: ActorCompanion,
) {
  const e = await repo.getServiceEvent(eventId)
  if (!e) throw new CareRuleError('找不到這筆事件')
  if (e.companion_id !== actor.id) throw new CareRuleError('只能更正自己建立的事件')
  if (e.invalidated_at) throw new CareRuleError('這筆事件已經作廢過了')
  if (e.visibility === 'family') {
    throw new CareRuleError('已對家屬顯示的事件需由督導處理，請改為建立需督導注意的事件')
  }

  await repo.invalidateServiceEvent(eventId, {
    invalidated_at: new Date().toISOString(),
    invalidated_by_type: 'companion',
    invalidate_reason_code: reasonCode,
  })
  return { eventId }
}

/** 督導決定哪些事件對家屬顯示；陪診員無法自行公開 */
export async function setCareServiceEventVisibility(
  eventId: number, visible: boolean, actor: ActorAdmin,
) {
  const e = await repo.getServiceEvent(eventId)
  if (!e) throw new CareRuleError('找不到這筆事件')
  if (e.invalidated_at) throw new CareRuleError('已作廢的事件不可對家屬顯示')
  if (visible && !mayEverBeFamilyVisible(e.event_type as ServiceEventType)) {
    throw new CareRuleError('這個類型的事件不對家屬顯示')
  }
  await repo.setEventVisibility(eventId, visible ? 'family' : 'internal')
  return { eventId, visibility: visible ? 'family' : 'internal' }
}

// ══════════ 2. 內部服務紀錄 ══════════
export async function saveOwnCareServiceRecordDraft(
  bookingId: number, input: RecordDraftInput, actor: ActorCompanion,
) {
  const b = await loadOwnBooking(bookingId, actor.id)
  if (!RECORDABLE_STATUSES.includes(b.status)) {
    throw new CareRuleError(`服務狀態為「${b.status}」，目前不能填寫服務紀錄`)
  }

  const existing = await repo.getActiveRecordForBooking(bookingId)

  if (!existing) {
    const revision = await repo.nextRecordRevision(bookingId)
    const created = await repo.insertRecord({
      booking_id: bookingId, companion_id: actor.id, revision, status: 'draft', ...input,
    })
    return { recordId: created.id, status: created.status }
  }

  if (existing.companion_id !== actor.id) {
    throw new CareRuleError('這份服務紀錄不是您建立的')
  }
  if (!isRecordStaffEditable(existing.status as RecordStatus)) {
    throw new CareRuleError(`狀態為「${existing.status}」的服務紀錄不可修改`)
  }

  await repo.updateRecord(existing.id, input)
  return { recordId: existing.id, status: existing.status }
}

export async function submitOwnCareServiceRecord(bookingId: number, actor: ActorCompanion) {
  await loadOwnBooking(bookingId, actor.id)
  const rec = await repo.getActiveRecordForBooking(bookingId)
  if (!rec) throw new CareRuleError('尚未建立服務紀錄')
  if (rec.companion_id !== actor.id) throw new CareRuleError('這份服務紀錄不是您建立的')

  assertTransition(RECORD_TRANSITIONS, rec.status as RecordStatus, 'submitted', '服務紀錄')
  await repo.updateRecord(rec.id, {
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    return_reason_code: null,
  })
  return { recordId: rec.id, from: rec.status, to: 'submitted' as const }
}

export async function returnCareServiceRecordForRevision(
  recordId: number, reasonCode: string, actor: ActorAdmin,
) {
  const rec = await repo.getRecord(recordId)
  if (!rec) throw new CareRuleError('找不到這份服務紀錄')
  assertTransition(RECORD_TRANSITIONS, rec.status as RecordStatus, 'returned_for_revision', '服務紀錄')
  await repo.updateRecord(recordId, {
    status: 'returned_for_revision',
    return_reason_code: reasonCode,
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
  })
  return { from: rec.status, to: 'returned_for_revision' as const }
}

export async function reviewCareServiceRecord(recordId: number, actor: ActorAdmin) {
  const rec = await repo.getRecord(recordId)
  if (!rec) throw new CareRuleError('找不到這份服務紀錄')
  assertTransition(RECORD_TRANSITIONS, rec.status as RecordStatus, 'reviewed', '服務紀錄')
  await repo.updateRecord(recordId, {
    status: 'reviewed',
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
  })
  return { from: rec.status, to: 'reviewed' as const, bookingId: rec.booking_id }
}

// ══════════ 3. 家屬小結 ══════════
export async function createCareFamilySummaryDraft(
  bookingId: number, input: SummaryDraftInput, actor: ActorAdmin,
) {
  await loadBookingOrThrow(bookingId)
  const version = await repo.nextSummaryVersion(bookingId)
  const rec = await repo.getActiveRecordForBooking(bookingId)

  const created = await repo.insertSummary({
    booking_id: bookingId,
    source_record_id: rec?.id ?? null,
    version_number: version,
    status: 'draft',
    created_by_admin_id: actor.id,
    ...input,
  })
  return { summaryId: created.id, version }
}

export async function updateCareFamilySummaryDraft(
  summaryId: number, input: SummaryDraftInput, actor: ActorAdmin,
) {
  const s = await repo.getSummary(summaryId)
  if (!s) throw new CareRuleError('找不到這份小結')
  if (s.status !== 'draft' && s.status !== 'in_review') {
    throw new CareRuleError(`狀態為「${s.status}」的小結不可修改，請建立新版本`)
  }
  await repo.updateSummary(summaryId, input)
  return { summaryId }
}

export async function submitCareFamilySummaryForReview(summaryId: number, actor: ActorAdmin) {
  const s = await repo.getSummary(summaryId)
  if (!s) throw new CareRuleError('找不到這份小結')
  assertTransition(SUMMARY_TRANSITIONS, s.status as SummaryStatus, 'in_review', '家屬小結')
  await repo.updateSummary(summaryId, { status: 'in_review' })
  return { from: s.status, to: 'in_review' as const }
}

export async function publishCareFamilySummary(summaryId: number, actor: ActorAdmin) {
  const s = await repo.getSummary(summaryId)
  if (!s) throw new CareRuleError('找不到這份小結')
  assertTransition(SUMMARY_TRANSITIONS, s.status as SummaryStatus, 'published', '家屬小結')

  // 一筆服務同時只能有一份已發布：舊的先標記為被取代
  const existing = await repo.getPublishedSummary(s.booking_id)
  if (existing && existing.id !== summaryId) {
    await repo.updateSummary(existing.id, { status: 'superseded' })
  }

  await repo.updateSummary(summaryId, {
    status: 'published',
    published_at: new Date().toISOString(),
    published_by_admin_id: actor.id,
  })
  return { from: s.status, to: 'published' as const, bookingId: s.booking_id }
}

export async function withdrawCareFamilySummary(
  summaryId: number, reasonCode: string, actor: ActorAdmin,
) {
  const s = await repo.getSummary(summaryId)
  if (!s) throw new CareRuleError('找不到這份小結')
  assertTransition(SUMMARY_TRANSITIONS, s.status as SummaryStatus, 'withdrawn', '家屬小結')
  await repo.updateSummary(summaryId, {
    status: 'withdrawn',
    withdrawn_at: new Date().toISOString(),
    withdrawn_by_admin_id: actor.id,
    withdraw_reason_code: reasonCode,
  })
  return { from: s.status, to: 'withdrawn' as const }
}

// ══════════ 4. 異常事件 ══════════
export async function createOwnCareIncident(
  bookingId: number, input: IncidentInput, actor: ActorCompanion,
) {
  await loadOwnBooking(bookingId, actor.id)
  const row = await repo.insertIncident({
    booking_id: bookingId,
    companion_id: actor.id,
    incident_type: input.incident_type,
    severity: input.severity,
    description: input.description,
    status: 'open',
    // 是否需要通知家屬由督導決定，陪診員不能自行標記
    notification_status: 'not_required',
  })
  return { incidentId: row.id }
}

export async function acknowledgeCareIncident(incidentId: number, actor: ActorAdmin) {
  const i = await repo.getIncident(incidentId)
  if (!i) throw new CareRuleError('找不到這筆異常事件')
  assertTransition(INCIDENT_TRANSITIONS, i.status as IncidentStatus, 'acknowledged', '異常事件')
  await repo.updateIncident(incidentId, {
    status: 'acknowledged',
    acknowledged_at: new Date().toISOString(),
    acknowledged_by_admin_id: actor.id,
  })
  return { from: i.status, to: 'acknowledged' as const }
}

export async function resolveCareIncident(
  incidentId: number, resolutionCode: string, actor: ActorAdmin,
) {
  const i = await repo.getIncident(incidentId)
  if (!i) throw new CareRuleError('找不到這筆異常事件')
  assertTransition(INCIDENT_TRANSITIONS, i.status as IncidentStatus, 'resolved', '異常事件')
  await repo.updateIncident(incidentId, {
    status: 'resolved',
    resolution_code: resolutionCode,
    resolved_at: new Date().toISOString(),
    resolved_by_admin_id: actor.id,
  })
  return { from: i.status, to: 'resolved' as const }
}

export async function closeCareIncident(incidentId: number, actor: ActorAdmin) {
  const i = await repo.getIncident(incidentId)
  if (!i) throw new CareRuleError('找不到這筆異常事件')
  assertTransition(INCIDENT_TRANSITIONS, i.status as IncidentStatus, 'closed', '異常事件')
  await repo.updateIncident(incidentId, { status: 'closed', closed_at: new Date().toISOString() })
  return { from: i.status, to: 'closed' as const }
}

/**
 * 只能推進到「已準備通知內容」。
 * 目前沒有任何外部通知 connector，因此系統絕不會標記為已送出 ——
 * Service、domain 與資料庫 trigger 三處都擋。
 */
export async function markCareIncidentNotificationPrepared(incidentId: number, actor: ActorAdmin) {
  const i = await repo.getIncident(incidentId)
  if (!i) throw new CareRuleError('找不到這筆異常事件')
  const from = i.notification_status as NotificationStatus

  // 冪等：已經是 prepared 就直接回，避免重複點擊變成錯誤
  if (from === 'prepared') return { from, to: 'prepared' as const }

  if (from === 'not_required') {
    assertNotificationTransition(from, 'pending')
    await repo.updateIncident(incidentId, { notification_status: 'pending' })
    return { from, to: 'pending' as const }
  }
  assertNotificationTransition(from, 'prepared')
  await repo.updateIncident(incidentId, { notification_status: 'prepared' })
  return { from, to: 'prepared' as const }
}

// ══════════ 5. 家屬授權 ══════════
export async function grantCareServiceAuthorization(
  bookingId: number, userId: string, scope: AuthorizationScope, actor: ActorAdmin,
) {
  assertScopeEnabled(scope)
  await loadBookingOrThrow(bookingId)
  await repo.upsertAuthorization({
    booking_id: bookingId, user_id: userId, scope,
    granted_at: new Date().toISOString(),
    granted_by_admin_id: actor.id,
    revoked_at: null, revoked_by_admin_id: null, revoke_reason_code: null,
  })
  return { bookingId, scope }
}

export async function revokeCareServiceAuthorization(authId: number, actor: ActorAdmin) {
  await repo.revokeAuthorization(authId, {
    revoked_at: new Date().toISOString(),
    revoked_by_admin_id: actor.id,
    revoke_reason_code: 'revoked_by_operations',
  })
  return { authId }
}

/**
 * 家屬端唯一的讀取入口。
 * 沒有有效授權就回 null —— 不是回空物件、也不是回部分資料，
 * 呼叫端會轉成 404，避免用 id 探測某筆服務是否存在。
 */
export async function getAuthorizedFamilyView(bookingId: number, userId: string | null) {
  if (!userId) return null

  const auths = await repo.listAuthorizationsForUser(userId, bookingId)
  const canSummary = hasServiceAuthorization(auths as any, bookingId, userId, 'view_service_summary')
  const canNotify = hasServiceAuthorization(auths as any, bookingId, userId, 'receive_service_notification')
  if (!canSummary && !canNotify) return null

  const b = await repo.getBooking(bookingId)
  if (!b) return null

  const summary = canSummary ? await repo.getPublishedSummary(bookingId) : null
  const events = canNotify ? await repo.listFamilyVisibleEvents(bookingId) : []

  // 只回家屬被授權看的欄位：不含 companion_id、內部紀錄、金額、其他訂單
  return {
    booking: {
      booking_no: b.booking_no,
      status: b.status,
      service_name: b.service_name,
      service_date: b.service_date,
      hospital: b.hospital,
      patient_name: b.patient_name,
    },
    scopes: { view_service_summary: canSummary, receive_service_notification: canNotify },
    events,
    summary: summary
      ? {
          version_number: summary.version_number,
          published_at: summary.published_at,
          service_window_text: summary.service_window_text,
          completed_steps_text: summary.completed_steps_text,
          family_actions_text: summary.family_actions_text,
          next_arrangement_text: summary.next_arrangement_text,
          handover_status_text: summary.handover_status_text,
        }
      : null,
  }
}

// ══════════ 6. 結算 ══════════
function makeBatchNo(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  return `SB${d}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/**
 * 由已完成的兼職服務產生待審核明細。
 * 唯一性由資料庫的 (booking_id, line_type) unique 保證 ——
 * 前端重試或並發不會產生兩筆。
 */
export async function generatePendingPartTimeSettlementLine(
  bookingId: number, actor: ActorAdmin,
) {
  const b = await loadBookingOrThrow(bookingId)
  if (b.status !== '已完成') {
    throw new CareRuleError('只有已完成的服務才能產生結算明細')
  }
  if (!b.companion_id) throw new CareRuleError('這筆服務尚未指派陪診員')

  const employment = await repo.getCompanionEmploymentType(b.companion_id)
  if (!employment) throw new CareRuleError('找不到陪診員資料')
  assertPartTimeForSettlement(employment)

  const existing = await repo.findLineByBookingAndType(bookingId, 'service_compensation')
  if (existing) {
    // 冪等：已經有就回既有那筆，不重複建立也不報錯
    return { lineId: existing.id, amount: existing.amount, created: false }
  }

  const amount =
    (b.companion_fee || 0) + (b.addon_companion_fee || 0) + (b.extra_companion_fee || 0)

  const line = await repo.insertSettlementLine({
    booking_id: bookingId,
    companion_id: b.companion_id,
    employment_type_snapshot: employment,
    line_type: 'service_compensation',
    amount,
    currency: 'TWD',
    basis_snapshot: `方案報酬 ${b.companion_fee || 0} ＋加購 ${b.addon_companion_fee || 0} ＋額外 ${b.extra_companion_fee || 0}`,
    status: 'pending_review',
  })
  return { lineId: line.id, amount: line.amount, created: true }
}

export async function createManualSettlementLine(
  bookingId: number, input: ManualLineInput, actor: ActorAdmin,
) {
  const b = await loadBookingOrThrow(bookingId)
  if (!b.companion_id) throw new CareRuleError('這筆服務尚未指派陪診員')
  const employment = await repo.getCompanionEmploymentType(b.companion_id)
  if (!employment) throw new CareRuleError('找不到陪診員資料')
  assertPartTimeForSettlement(employment)

  const existing = await repo.findLineByBookingAndType(bookingId, input.line_type)
  if (existing) {
    throw new CareRuleError(`這筆服務已經有一筆「${input.line_type}」明細了`)
  }

  const line = await repo.insertSettlementLine({
    booking_id: bookingId,
    companion_id: b.companion_id,
    employment_type_snapshot: employment,
    line_type: input.line_type,
    amount: input.amount,
    currency: 'TWD',
    basis_snapshot: input.basis_snapshot,
    reason_code: input.reason_code,
    status: 'pending_review',
  })
  return { lineId: line.id }
}

export async function reviewCareSettlementLine(
  lineId: number, decision: 'approve' | 'reject', note: string | null, actor: ActorAdmin,
) {
  const l = await repo.getSettlementLine(lineId)
  if (!l) throw new CareRuleError('找不到這筆結算明細')
  const to: LineStatus = decision === 'approve' ? 'approved' : 'rejected'
  assertTransition(LINE_TRANSITIONS, l.status as LineStatus, to, '結算明細')
  await repo.updateSettlementLine(lineId, {
    status: to,
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
    review_note: note,
  })
  return { from: l.status, to }
}

export async function createCareSettlementBatch(
  periodStart: string, periodEnd: string, lineIds: number[], actor: ActorAdmin,
) {
  const batch = await repo.insertBatch({
    batch_no: makeBatchNo(),
    period_start: periodStart,
    period_end: periodEnd,
    status: 'draft',
    created_by_admin_id: actor.id,
  })
  // 只有 approved 的明細會被掛進批次（repository 層以 .eq('status','approved') 保證）
  await repo.attachLinesToBatch(batch.id, lineIds)
  return { batchId: batch.id, batchNo: batch.batch_no }
}

export async function approveCareSettlementBatch(batchId: number, actor: ActorAdmin) {
  const b = await repo.getBatch(batchId)
  if (!b) throw new CareRuleError('找不到這個批次')
  assertTransition(BATCH_TRANSITIONS, b.status as BatchStatus, 'approved', '結算批次')
  await repo.updateBatch(batchId, {
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by_admin_id: actor.id,
  })
  return { from: b.status, to: 'approved' as const }
}

/**
 * 發布後陪診員才看得到自己的金額。
 * ⚠️ 發布不代表已付款，系統沒有串接任何金流。
 */
export async function publishCareSettlementBatch(batchId: number, actor: ActorAdmin) {
  const b = await repo.getBatch(batchId)
  if (!b) throw new CareRuleError('找不到這個批次')
  assertTransition(BATCH_TRANSITIONS, b.status as BatchStatus, 'published', '結算批次')
  await repo.updateBatch(batchId, { status: 'published', published_at: new Date().toISOString() })
  await repo.publishBatchLines(batchId)
  return { from: b.status, to: 'published' as const }
}

export async function closeCareSettlementBatch(batchId: number, actor: ActorAdmin) {
  const b = await repo.getBatch(batchId)
  if (!b) throw new CareRuleError('找不到這個批次')
  assertTransition(BATCH_TRANSITIONS, b.status as BatchStatus, 'closed', '結算批次')
  await repo.updateBatch(batchId, { status: 'closed', closed_at: new Date().toISOString() })
  return { from: b.status, to: 'closed' as const }
}

// ══════════ 7. 控制台 ══════════
export async function getCareServiceControlOverview() {
  const [records, summaries, incidents, lines] = await Promise.all([
    repo.countBy('care_service_records', 'status'),
    repo.countBy('care_family_summaries', 'status'),
    repo.countBy('care_incidents', 'status'),
    repo.countBy('care_settlement_lines', 'status'),
  ])
  return {
    records_submitted: records.submitted || 0,
    records_returned: records.returned_for_revision || 0,
    records_reviewed: records.reviewed || 0,
    summaries_draft: (summaries.draft || 0) + (summaries.in_review || 0),
    summaries_published: summaries.published || 0,
    summaries_withdrawn: summaries.withdrawn || 0,
    incidents_open: (incidents.open || 0) + (incidents.acknowledged || 0),
    incidents_resolved: incidents.resolved || 0,
    lines_pending: lines.pending_review || 0,
    lines_approved: lines.approved || 0,
  }
}

/** 單筆服務的營運全貌（後台用，含內部資料） */
export async function getCareServiceDetail(bookingId: number) {
  const booking = await loadBookingOrThrow(bookingId)
  const [events, record, summaries, incidents, auths] = await Promise.all([
    repo.listServiceEvents(bookingId),
    repo.getActiveRecordForBooking(bookingId),
    repo.listSummariesForBooking(bookingId),
    repo.listIncidentsForBooking(bookingId),
    repo.listAuthorizationsForBooking(bookingId),
  ])
  return { booking, events, record, summaries, incidents, authorizations: auths }
}

/** 陪診員端：自己的服務履約狀態 */
export async function getOwnServiceWorkspace(bookingId: number, actor: ActorCompanion) {
  const booking = await loadOwnBooking(bookingId, actor.id)
  const [events, record, incidents, summaries] = await Promise.all([
    repo.listServiceEvents(bookingId),
    repo.getActiveRecordForBooking(bookingId),
    repo.listIncidentsForBooking(bookingId),
    repo.listSummariesForBooking(bookingId),
  ])
  const published = summaries.find(s => s.status === 'published')
  const pending = summaries.find(s => s.status === 'draft' || s.status === 'in_review')

  return {
    booking: {
      id: booking.id, booking_no: booking.booking_no, status: booking.status,
      service_name: booking.service_name, service_date: booking.service_date,
      hospital: booking.hospital, patient_name: booking.patient_name,
    },
    events: events.filter(e => e.companion_id === actor.id || e.visibility === 'family'),
    record,
    incidents: incidents.filter(i => i.companion_id === actor.id),
    // 陪診員只知道小結「到哪一步了」，看不到內容也不能發布
    summary_state: published ? 'published' : pending ? pending.status : 'none',
  }
}

export async function getOwnPublishedSettlement(actor: ActorCompanion) {
  const employment = await repo.getCompanionEmploymentType(actor.id)
  if (employment !== 'parttime') {
    // 全職不顯示金額，只回服務統計的佔位
    return { employment_type: employment, lines: [], total: 0, fulltime_notice: true }
  }
  const lines = await repo.listPublishedLinesForCompanion(actor.id)
  return {
    employment_type: employment,
    lines,
    total: lines.reduce((s, l) => s + l.amount, 0),
    fulltime_notice: false,
  }
}
