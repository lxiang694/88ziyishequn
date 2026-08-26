/**
 * Sprint E 營運閉環 Repository —— 唯一直接碰資料庫的一層。
 * React component 不得 import 這個檔案。
 *
 * 授權強制點與前幾輪相同：Route Handler + Service 守衛；
 * RLS 是縱深防禦（伺服器走 service_role，會繞過 RLS）。詳見 SECURITY.md。
 */
import { supabaseAdmin } from '@/lib/supabase'
import { CareTableMissingError } from '../repository'

export { CareTableMissingError }

function raise(error: { code?: string; message: string } | null): void {
  if (!error) return
  if (error.code === '42P01') throw new CareTableMissingError()
  // 唯一性衝突讓 Service 自己判斷是不是「已經有了」
  if (error.code === '23505') { const e: any = new Error(error.message); e.code = '23505'; throw e }
  throw new Error(error.message)
}

export function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as any).code === '23505'
}

// ── 通知 ────────────────────────────────────────────────────
export interface NotificationRow {
  id: number
  recipient_user_id: string | null
  recipient_companion_id: number | null
  booking_id: number | null
  notification_type: string
  status: string
  title: string
  body: string | null
  link_path: string | null
  created_at: string
  read_at: string | null
}

export async function insertNotification(row: {
  recipient_user_id?: string | null
  recipient_companion_id?: number | null
  booking_id: number | null
  notification_type: string
  title: string
  body: string
  link_path: string | null
  created_by_admin_id: number | null
  source_reference: string | null
}): Promise<NotificationRow> {
  const { data, error } = await supabaseAdmin
    .from('care_notifications').insert(row).select('*').single()
  raise(error as any)
  return data as NotificationRow
}

export async function getNotification(id: number): Promise<NotificationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_notifications').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as NotificationRow) || null
}

export async function listNotificationsForUser(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_notifications').select('*')
    .eq('recipient_user_id', userId).neq('status', 'archived')
    .order('created_at', { ascending: false }).limit(50)
  raise(error as any)
  return (data as NotificationRow[]) || []
}

export async function listNotificationsForCompanion(companionId: number): Promise<NotificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_notifications').select('*')
    .eq('recipient_companion_id', companionId).neq('status', 'archived')
    .order('created_at', { ascending: false }).limit(50)
  raise(error as any)
  return (data as NotificationRow[]) || []
}

export async function updateNotificationStatus(id: number, status: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_notifications').update({ status }).eq('id', id)
  raise(error as any)
}

/** 後台清單：刻意不 select body —— 後台不需要看到每則內文 */
export async function listNotificationMetadata(limit = 100): Promise<{
  id: number; notification_type: string; status: string; booking_id: number | null
  created_at: string; recipient_kind: string
}[]> {
  const { data, error } = await supabaseAdmin
    .from('care_notifications')
    .select('id, notification_type, status, booking_id, created_at, recipient_user_id, recipient_companion_id')
    .order('created_at', { ascending: false }).limit(limit)
  raise(error as any)
  return ((data as any[]) || []).map(r => ({
    id: r.id,
    notification_type: r.notification_type,
    status: r.status,
    booking_id: r.booking_id,
    created_at: r.created_at,
    recipient_kind: r.recipient_user_id ? 'family' : 'staff',
  }))
}

// ── 通知偏好 ────────────────────────────────────────────────
export interface PreferenceRow {
  id: number
  user_id: string | null
  companion_id: number | null
  category: string
  in_app_enabled: boolean
  external_channel_opt_in: boolean
  external_channel_state: string
}

export async function listPreferencesForUser(userId: string): Promise<PreferenceRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_notification_preferences').select('*').eq('user_id', userId)
  raise(error as any)
  return (data as PreferenceRow[]) || []
}

export async function listPreferencesForCompanion(companionId: number): Promise<PreferenceRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_notification_preferences').select('*').eq('companion_id', companionId)
  raise(error as any)
  return (data as PreferenceRow[]) || []
}

export async function upsertPreference(row: {
  user_id?: string | null
  companion_id?: number | null
  category: string
  in_app_enabled: boolean
}): Promise<void> {
  const key = row.user_id
    ? { user_id: row.user_id, category: row.category }
    : { companion_id: row.companion_id, category: row.category }

  const q = supabaseAdmin.from('care_notification_preferences').select('id').eq('category', row.category)
  const { data, error } = row.user_id
    ? await q.eq('user_id', row.user_id).maybeSingle()
    : await q.eq('companion_id', row.companion_id!).maybeSingle()
  raise(error as any)

  if (data) {
    const { error: e2 } = await supabaseAdmin
      .from('care_notification_preferences')
      .update({ in_app_enabled: row.in_app_enabled }).eq('id', (data as any).id)
    raise(e2 as any)
  } else {
    const { error: e3 } = await supabaseAdmin
      .from('care_notification_preferences')
      .insert({ ...key, in_app_enabled: row.in_app_enabled })
    raise(e3 as any)
  }
}

// ── Outbox ──────────────────────────────────────────────────
export interface OutboxRow {
  id: number
  notification_id: number
  channel: string
  status: string
  suppression_reason_code: string | null
  created_at: string
}

export async function insertOutbox(row: {
  notification_id: number
  channel: string
  status: string
  suppression_reason_code: string | null
}): Promise<OutboxRow> {
  const { data, error } = await supabaseAdmin
    .from('care_notification_outbox').insert(row).select('*').single()
  raise(error as any)
  return data as OutboxRow
}

export async function listOutbox(limit = 100): Promise<OutboxRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_notification_outbox').select('*')
    .order('created_at', { ascending: false }).limit(limit)
  raise(error as any)
  return (data as OutboxRow[]) || []
}

export async function suppressOutbox(
  id: number, reasonCode: string, adminId: number,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_notification_outbox')
    .update({
      status: 'suppressed', suppression_reason_code: reasonCode,
      suppressed_at: new Date().toISOString(), suppressed_by_admin_id: adminId,
    })
    .eq('id', id)
  raise(error as any)
}

export async function countOutboxByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('care_notification_outbox').select('status')
  raise(error as any)
  const out: Record<string, number> = {}
  for (const r of (data as any[]) || []) out[r.status] = (out[r.status] || 0) + 1
  return out
}

// ── 回饋 ────────────────────────────────────────────────────
export interface FeedbackRequestRow {
  id: number
  booking_id: number
  recipient_user_id: string
  summary_id: number | null
  status: string
  expires_at: string | null
  created_at: string
}

export async function insertFeedbackRequest(row: {
  booking_id: number; recipient_user_id: string
  summary_id: number | null; expires_at: string | null
}): Promise<FeedbackRequestRow> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback_requests').insert(row).select('*').single()
  raise(error as any)
  return data as FeedbackRequestRow
}

export async function getFeedbackRequest(id: number): Promise<FeedbackRequestRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback_requests').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as FeedbackRequestRow) || null
}

export async function findFeedbackRequest(
  bookingId: number, userId: string,
): Promise<FeedbackRequestRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback_requests').select('*')
    .eq('booking_id', bookingId).eq('recipient_user_id', userId).maybeSingle()
  raise(error as any)
  return (data as FeedbackRequestRow) || null
}

export async function listFeedbackRequestsForUser(userId: string): Promise<FeedbackRequestRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback_requests').select('*')
    .eq('recipient_user_id', userId).in('status', ['eligible', 'presented'])
    .order('created_at', { ascending: false })
  raise(error as any)
  return (data as FeedbackRequestRow[]) || []
}

export async function updateFeedbackRequestStatus(id: number, status: string): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'presented') patch.presented_at = new Date().toISOString()
  if (status === 'completed') patch.completed_at = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('care_feedback_requests').update(patch).eq('id', id)
  raise(error as any)
}

export interface FeedbackRow {
  id: number
  request_id: number
  booking_id: number
  submitted_by_user_id: string
  score_reassurance: number
  score_communication: number
  score_process_support: number
  comment: string | null
  status: string
  created_at: string
}

export async function insertFeedback(row: {
  request_id: number; booking_id: number; submitted_by_user_id: string
  score_reassurance: number; score_communication: number; score_process_support: number
  comment: string | null
}): Promise<FeedbackRow> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback').insert(row).select('*').single()
  raise(error as any)
  return data as FeedbackRow
}

export async function getFeedbackByRequest(requestId: number): Promise<FeedbackRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback').select('*').eq('request_id', requestId).maybeSingle()
  raise(error as any)
  return (data as FeedbackRow) || null
}

export async function listFeedback(limit = 100): Promise<FeedbackRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback').select('*')
    .order('created_at', { ascending: false }).limit(limit)
  raise(error as any)
  return (data as FeedbackRow[]) || []
}

/** 指標用：只取分數，不取意見全文，也不取是誰填的 */
export async function listFeedbackScores(): Promise<
  { score_reassurance: number; score_communication: number; score_process_support: number }[]
> {
  const { data, error } = await supabaseAdmin
    .from('care_feedback').select('score_reassurance, score_communication, score_process_support')
  raise(error as any)
  return (data as any[]) || []
}

export async function updateFeedbackStatus(id: number, status: string, adminId: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_feedback')
    .update({ status, reviewed_by_admin_id: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  raise(error as any)
}

// ── 意見／申訴 ──────────────────────────────────────────────
export interface ConcernRow {
  id: number
  booking_id: number | null
  source: string
  source_user_id: string | null
  source_companion_id: number | null
  feedback_id: number | null
  category: string
  status: string
  owner_admin_id: number | null
  due_date: string | null
  description: string
  resolution_code: string | null
  internal_note: string | null
  created_at: string
  resolved_at: string | null
}

export async function insertConcern(row: {
  booking_id: number | null; source: string
  source_user_id?: string | null; source_companion_id?: number | null
  feedback_id?: number | null; category: string; description: string
}): Promise<ConcernRow> {
  const { data, error } = await supabaseAdmin
    .from('care_concerns').insert(row).select('*').single()
  raise(error as any)
  return data as ConcernRow
}

export async function getConcern(id: number): Promise<ConcernRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_concerns').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as ConcernRow) || null
}

export async function listConcerns(status?: string): Promise<ConcernRow[]> {
  let q = supabaseAdmin.from('care_concerns').select('*')
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  raise(error as any)
  return (data as ConcernRow[]) || []
}

export async function listConcernsForUser(userId: string): Promise<ConcernRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_concerns').select('*')
    .eq('source_user_id', userId).order('created_at', { ascending: false })
  raise(error as any)
  return (data as ConcernRow[]) || []
}

export async function updateConcern(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_concerns').update(patch).eq('id', id)
  raise(error as any)
}

export async function countOverdueConcerns(today: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('care_concerns').select('id')
    .not('due_date', 'is', null).lt('due_date', today)
    .in('status', ['open', 'acknowledged', 'in_follow_up'])
  raise(error as any)
  return ((data as any[]) || []).length
}

// ── 品質覆核 ────────────────────────────────────────────────
export interface QualityReviewRow {
  id: number
  booking_id: number
  reviewer_admin_id: number | null
  status: string
  chk_events_complete: boolean | null
  chk_record_on_time: boolean | null
  chk_summary_clear: boolean | null
  chk_authorization_correct: boolean | null
  chk_communication_done: boolean | null
  internal_note: string | null
  created_at: string
  completed_at: string | null
}

export async function insertQualityReview(row: {
  booking_id: number; reviewer_admin_id: number
}): Promise<QualityReviewRow> {
  const { data, error } = await supabaseAdmin
    .from('care_quality_reviews').insert(row).select('*').single()
  raise(error as any)
  return data as QualityReviewRow
}

export async function getQualityReview(id: number): Promise<QualityReviewRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_quality_reviews').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as QualityReviewRow) || null
}

export async function findQualityReviewByBooking(bookingId: number): Promise<QualityReviewRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_quality_reviews').select('*').eq('booking_id', bookingId).maybeSingle()
  raise(error as any)
  return (data as QualityReviewRow) || null
}

export async function listQualityReviews(status?: string): Promise<QualityReviewRow[]> {
  let q = supabaseAdmin.from('care_quality_reviews').select('*')
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  raise(error as any)
  return (data as QualityReviewRow[]) || []
}

export async function updateQualityReview(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_quality_reviews').update(patch).eq('id', id)
  raise(error as any)
}

export interface FollowUpRow {
  id: number
  review_id: number
  owner_companion_id: number | null
  owner_admin_id: number | null
  action_code: string
  staff_visible_note: string | null
  due_date: string | null
  status: string
  created_at: string
}

export async function insertFollowUp(row: {
  review_id: number; owner_companion_id: number | null; owner_admin_id: number | null
  action_code: string; staff_visible_note: string | null; due_date: string | null
}): Promise<FollowUpRow> {
  const { data, error } = await supabaseAdmin
    .from('care_quality_follow_ups').insert(row).select('*').single()
  raise(error as any)
  return data as FollowUpRow
}

export async function getFollowUp(id: number): Promise<FollowUpRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_quality_follow_ups').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as FollowUpRow) || null
}

export async function listFollowUpsForCompanion(companionId: number): Promise<FollowUpRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_quality_follow_ups').select('*')
    .eq('owner_companion_id', companionId).neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  raise(error as any)
  return (data as FollowUpRow[]) || []
}

export async function listFollowUps(status?: string): Promise<FollowUpRow[]> {
  let q = supabaseAdmin.from('care_quality_follow_ups').select('*')
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  raise(error as any)
  return (data as FollowUpRow[]) || []
}

export async function updateFollowUp(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_quality_follow_ups').update(patch).eq('id', id)
  raise(error as any)
}

// ── 政策版本 ────────────────────────────────────────────────
export interface PolicyVersionRow {
  id: number
  policy_kind: string
  version_label: string
  status: string
  body_text: string | null
  published_at: string | null
  created_at: string
}

export async function listPolicyVersions(): Promise<PolicyVersionRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_policy_versions').select('*')
    .order('policy_kind', { ascending: true }).order('created_at', { ascending: false })
  raise(error as any)
  return (data as PolicyVersionRow[]) || []
}

export async function getPolicyVersion(id: number): Promise<PolicyVersionRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_policy_versions').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as PolicyVersionRow) || null
}

export async function listPublishedPolicyKinds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('care_policy_versions').select('policy_kind').eq('status', 'published')
  raise(error as any)
  return ((data as any[]) || []).map(r => r.policy_kind)
}

export async function insertPolicyVersion(row: {
  policy_kind: string; version_label: string; body_text: string; created_by_admin_id: number
}): Promise<PolicyVersionRow> {
  const { data, error } = await supabaseAdmin
    .from('care_policy_versions').insert({ ...row, status: 'draft' }).select('*').single()
  raise(error as any)
  return data as PolicyVersionRow
}

export async function retirePublishedPolicy(kind: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_policy_versions')
    .update({ status: 'retired', retired_at: new Date().toISOString() })
    .eq('policy_kind', kind).eq('status', 'published')
  raise(error as any)
}

export async function publishPolicyVersion(id: number, adminId: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_policy_versions')
    .update({ status: 'published', published_by_admin_id: adminId })
    .eq('id', id)
  raise(error as any)
}

export async function insertPolicyAcceptance(row: {
  policy_version_id: number
  user_id?: string | null
  companion_id?: number | null
  booking_id: number | null
}): Promise<void> {
  const { error } = await supabaseAdmin.from('care_policy_acceptances').insert(row)
  raise(error as any)
}

export async function hasAcceptedPolicy(
  policyVersionId: number, userId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('care_policy_acceptances').select('id')
    .eq('policy_version_id', policyVersionId).eq('user_id', userId).maybeSingle()
  raise(error as any)
  return !!data
}

// ── 資料生命週期 ────────────────────────────────────────────
export interface LifecycleRow {
  id: number
  resource_kind: string
  booking_id: number | null
  status: string
  due_date: string | null
  reason_code: string
  note: string | null
  created_at: string
}

export async function insertLifecycleReview(row: {
  resource_kind: string; booking_id: number | null
  reason_code: string; due_date: string | null; note: string | null
}): Promise<LifecycleRow> {
  const { data, error } = await supabaseAdmin
    .from('care_data_lifecycle_reviews').insert(row).select('*').single()
  raise(error as any)
  return data as LifecycleRow
}

export async function listLifecycleReviews(): Promise<LifecycleRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_data_lifecycle_reviews').select('*')
    .order('due_date', { ascending: true, nullsFirst: false }).limit(200)
  raise(error as any)
  return (data as LifecycleRow[]) || []
}

export async function updateLifecycleReview(
  id: number, status: string, note: string | null, adminId: number,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_data_lifecycle_reviews')
    .update({ status, note, reviewer_admin_id: adminId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  raise(error as any)
}

// ── 指標與上線檢核用的計數 ─────────────────────────────────
async function countRows(table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count, error } = await q
  raise(error as any)
  return count || 0
}

export async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from(table).select('id').limit(1)
  if (error && (error as any).code === '42P01') return false
  if (error) return false
  return true
}

export interface OperationsQueueCounts {
  pending_intakes: number
  pending_dispatch: number
  in_service: number
  pending_record_review: number
  pending_summary_publish: number
  open_incidents: number
  open_concerns: number
  open_quality_follow_ups: number
  pending_settlement_lines: number
}

export async function getOperationsQueueCounts(): Promise<OperationsQueueCounts> {
  const safe = async (fn: () => Promise<number>) => {
    try { return await fn() } catch (e) {
      if (e instanceof CareTableMissingError) return 0
      throw e
    }
  }
  return {
    pending_intakes: await safe(() => countRows('care_intakes', q => q.eq('status', 'submitted'))),
    pending_dispatch: await safe(() => countRows('care_bookings', q => q.is('companion_id', null).eq('status', '待派工'))),
    in_service: await safe(() => countRows('care_bookings', q => q.eq('status', '服務中'))),
    pending_record_review: await safe(() => countRows('care_service_records', q => q.eq('status', 'submitted'))),
    pending_summary_publish: await safe(() => countRows('care_family_summaries', q => q.eq('status', 'in_review'))),
    open_incidents: await safe(() => countRows('care_incidents', q => q.in('status', ['open', 'acknowledged']))),
    open_concerns: await safe(() => countRows('care_concerns', q => q.in('status', ['open', 'acknowledged', 'in_follow_up']))),
    open_quality_follow_ups: await safe(() => countRows('care_quality_follow_ups', q => q.in('status', ['open', 'in_progress']))),
    pending_settlement_lines: await safe(() => countRows('care_settlement_lines', q => q.eq('status', 'pending_review'))),
  }
}

/** 上線檢核用：沒有僱用條件、沒有已驗證能力的陪診員數 */
export async function countStaffReadinessGaps(): Promise<{
  withoutEmployment: number; withoutCapability: number
}> {
  const { data: comps, error: e1 } = await supabaseAdmin
    .from('companions').select('id').eq('status', 'active')
  raise(e1 as any)
  const ids = ((comps as any[]) || []).map(c => c.id)
  if (ids.length === 0) return { withoutEmployment: 0, withoutCapability: 0 }

  const { data: terms, error: e2 } = await supabaseAdmin
    .from('staff_employment_terms').select('companion_id').neq('status', 'ended').in('companion_id', ids)
  raise(e2 as any)
  const withTerm = new Set(((terms as any[]) || []).map(t => t.companion_id))

  const { data: caps, error: e3 } = await supabaseAdmin
    .from('staff_capability_verifications').select('companion_id')
    .eq('status', 'verified').eq('capability_code', 'general_outpatient_flow')
    .in('companion_id', ids)
  raise(e3 as any)
  const withCap = new Set(((caps as any[]) || []).map(c => c.companion_id))

  return {
    withoutEmployment: ids.filter(i => !withTerm.has(i)).length,
    withoutCapability: ids.filter(i => !withCap.has(i)).length,
  }
}

export async function countBroadAccessAdmins(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('admin_users').select('permissions_json, role_key')
  raise(error as any)
  return ((data as any[]) || []).filter(a =>
    (Array.isArray(a.permissions_json) && a.permissions_json.includes('all'))
    || a.role_key === 'super_admin').length
}

// ── 授權查詢（沿用 Sprint D 的授權表） ─────────────────────
export async function listActiveAuthorizations(
  userId: string, bookingId: number,
): Promise<{ scope: string; revoked_at: string | null }[]> {
  const { data, error } = await supabaseAdmin
    .from('care_service_authorizations').select('scope, revoked_at')
    .eq('user_id', userId).eq('booking_id', bookingId).is('revoked_at', null)
  raise(error as any)
  return (data as any[]) || []
}

export async function getBookingBasics(id: number): Promise<{
  id: number; status: string; booking_no: string; user_id: string | null; companion_id: number | null
} | null> {
  const { data, error } = await supabaseAdmin
    .from('care_bookings').select('id, status, booking_no, user_id, companion_id')
    .eq('id', id).maybeSingle()
  raise(error as any)
  return (data as any) || null
}

export async function getPublishedSummaryId(bookingId: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('care_family_summaries').select('id')
    .eq('booking_id', bookingId).eq('status', 'published').maybeSingle()
  raise(error as any)
  return (data as any)?.id ?? null
}

// ── 指標：全部從真實資料算，沒有假數字 ─────────────────────
export async function getInsightCounts(): Promise<Record<string, number>> {
  const safe = async (fn: () => Promise<number>) => {
    try { return await fn() } catch (e) {
      if (e instanceof CareTableMissingError) return 0
      throw e
    }
  }
  return {
    intakes_total: await safe(() => countRows('care_intakes')),
    cases_total: await safe(() => countRows('care_cases')),
    quotes_confirmed: await safe(() => countRows('care_quote_estimates', q => q.eq('status', 'confirmed'))),
    bookings_total: await safe(() => countRows('care_bookings')),
    bookings_completed: await safe(() => countRows('care_bookings', q => q.eq('status', '已完成'))),
    proposals_accepted: await safe(() => countRows('care_dispatch_proposals', q => q.eq('status', 'accepted'))),
    proposals_declined: await safe(() => countRows('care_dispatch_proposals', q => q.eq('status', 'declined'))),
    summaries_published: await safe(() => countRows('care_family_summaries', q => q.eq('status', 'published'))),
    feedback_requests: await safe(() => countRows('care_feedback_requests')),
    feedback_submitted: await safe(() => countRows('care_feedback')),
  }
}
