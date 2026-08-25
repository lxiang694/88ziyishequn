/**
 * Sprint D 履約 Repository —— 唯一直接碰資料庫的一層。
 * React component 不得 import 這個檔案。
 *
 * 授權強制點與 Sprint B 相同：Route Handler + Service 守衛；
 * RLS 是縱深防禦（後台走 service_role，會繞過 RLS）。詳見 SECURITY.md。
 */
import { supabaseAdmin } from '@/lib/supabase'
import { CareTableMissingError } from '../repository'

export { CareTableMissingError }

function raise(error: { code?: string; message: string } | null): void {
  if (!error) return
  if (error.code === '42P01') throw new CareTableMissingError()
  throw new Error(error.message)
}

// ── 服務主體：care_bookings ────────────────────────────────
export interface BookingRow {
  id: number
  booking_no: string
  status: string
  companion_id: number | null
  user_id: string | null
  service_name: string | null
  service_date: string
  hospital: string | null
  county: string | null
  patient_name: string
  contact_name: string
  companion_fee: number | null
  addon_companion_fee: number | null
  extra_companion_fee: number | null
}

export async function getBooking(id: number): Promise<BookingRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_bookings').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as BookingRow) || null
}

export async function getCompanionEmploymentType(companionId: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('companions').select('employment_type').eq('id', companionId).maybeSingle()
  raise(error as any)
  return (data as any)?.employment_type ?? null
}

// ── 服務事件 ────────────────────────────────────────────────
export interface ServiceEventRow {
  id: number
  booking_id: number
  companion_id: number | null
  event_type: string
  family_note: string | null
  visibility: string
  invalidated_at: string | null
  invalidate_reason_code: string | null
  occurred_at: string
}

export async function insertServiceEvent(row: Record<string, unknown>): Promise<ServiceEventRow> {
  const { data, error } = await supabaseAdmin
    .from('care_service_events').insert(row).select('*').single()
  raise(error as any)
  return data as ServiceEventRow
}

export async function getServiceEvent(id: number): Promise<ServiceEventRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_service_events').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as ServiceEventRow) || null
}

export async function invalidateServiceEvent(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_service_events').update(patch).eq('id', id)
  raise(error as any)
}

export async function listServiceEvents(bookingId: number): Promise<ServiceEventRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_service_events').select('*')
    .eq('booking_id', bookingId).order('occurred_at', { ascending: true })
  raise(error as any)
  return (data || []) as ServiceEventRow[]
}

/** 家屬端專用：只回已允許顯示且未作廢的事件，且不回內部欄位 */
export async function listFamilyVisibleEvents(bookingId: number): Promise<
  { event_type: string; family_note: string | null; occurred_at: string }[]
> {
  const { data, error } = await supabaseAdmin
    .from('care_service_events')
    .select('event_type, family_note, occurred_at')
    .eq('booking_id', bookingId)
    .eq('visibility', 'family')
    .is('invalidated_at', null)
    .order('occurred_at', { ascending: true })
  raise(error as any)
  return (data || []) as any
}

export async function setEventVisibility(id: number, visibility: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('care_service_events').update({ visibility }).eq('id', id)
  raise(error as any)
}

// ── 內部服務紀錄 ────────────────────────────────────────────
export interface ServiceRecordRow {
  id: number
  booking_id: number
  companion_id: number
  revision: number
  status: string
  met_completed: boolean
  checkin_completed: boolean
  process_handover_completed: boolean
  return_arrangement_completed: boolean
  family_contact_completed: boolean
  family_follow_up_needed: boolean
  follow_up_reason_code: string | null
  objective_summary: string | null
  submitted_at: string | null
  reviewed_at: string | null
  return_reason_code: string | null
  created_at: string
  updated_at: string
}

export async function getActiveRecordForBooking(bookingId: number): Promise<ServiceRecordRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_service_records').select('*')
    .eq('booking_id', bookingId)
    .in('status', ['draft', 'submitted', 'returned_for_revision'])
    .maybeSingle()
  raise(error as any)
  return (data as ServiceRecordRow) || null
}

export async function getRecord(id: number): Promise<ServiceRecordRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_service_records').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as ServiceRecordRow) || null
}

export async function insertRecord(row: Record<string, unknown>): Promise<ServiceRecordRow> {
  const { data, error } = await supabaseAdmin
    .from('care_service_records').insert(row).select('*').single()
  raise(error as any)
  return data as ServiceRecordRow
}

export async function updateRecord(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_service_records').update(patch).eq('id', id)
  raise(error as any)
}

export async function listRecords(status?: string): Promise<ServiceRecordRow[]> {
  let q = supabaseAdmin.from('care_service_records').select('*')
    .order('updated_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as ServiceRecordRow[]
}

export async function listRecordsForCompanion(companionId: number): Promise<ServiceRecordRow[]> {
  const { data, error } = await supabaseAdmin.from('care_service_records').select('*')
    .eq('companion_id', companionId).order('updated_at', { ascending: false }).limit(100)
  raise(error as any)
  return (data || []) as ServiceRecordRow[]
}

export async function nextRecordRevision(bookingId: number): Promise<number> {
  const { data, error } = await supabaseAdmin.from('care_service_records')
    .select('revision').eq('booking_id', bookingId)
    .order('revision', { ascending: false }).limit(1)
  raise(error as any)
  const rows = (data || []) as { revision: number }[]
  return rows.length ? rows[0].revision + 1 : 1
}

// ── 家屬小結 ────────────────────────────────────────────────
export interface FamilySummaryRow {
  id: number
  booking_id: number
  source_record_id: number | null
  version_number: number
  status: string
  service_window_text: string | null
  completed_steps_text: string | null
  family_actions_text: string | null
  next_arrangement_text: string | null
  handover_status_text: string | null
  published_at: string | null
  withdrawn_at: string | null
  withdraw_reason_code: string | null
  created_at: string
  updated_at: string
}

export async function insertSummary(row: Record<string, unknown>): Promise<FamilySummaryRow> {
  const { data, error } = await supabaseAdmin
    .from('care_family_summaries').insert(row).select('*').single()
  raise(error as any)
  return data as FamilySummaryRow
}

export async function getSummary(id: number): Promise<FamilySummaryRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_family_summaries').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as FamilySummaryRow) || null
}

export async function updateSummary(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_family_summaries').update(patch).eq('id', id)
  raise(error as any)
}

export async function listSummaries(status?: string): Promise<FamilySummaryRow[]> {
  let q = supabaseAdmin.from('care_family_summaries').select('*')
    .order('updated_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as FamilySummaryRow[]
}

export async function listSummariesForBooking(bookingId: number): Promise<FamilySummaryRow[]> {
  const { data, error } = await supabaseAdmin.from('care_family_summaries').select('*')
    .eq('booking_id', bookingId).order('version_number', { ascending: false })
  raise(error as any)
  return (data || []) as FamilySummaryRow[]
}

/** 家屬端：只取已發布的那一份 */
export async function getPublishedSummary(bookingId: number): Promise<FamilySummaryRow | null> {
  const { data, error } = await supabaseAdmin.from('care_family_summaries').select('*')
    .eq('booking_id', bookingId).eq('status', 'published').maybeSingle()
  raise(error as any)
  return (data as FamilySummaryRow) || null
}

export async function nextSummaryVersion(bookingId: number): Promise<number> {
  const { data, error } = await supabaseAdmin.from('care_family_summaries')
    .select('version_number').eq('booking_id', bookingId)
    .order('version_number', { ascending: false }).limit(1)
  raise(error as any)
  const rows = (data || []) as { version_number: number }[]
  return rows.length ? rows[0].version_number + 1 : 1
}

// ── 異常事件 ────────────────────────────────────────────────
export interface IncidentRow {
  id: number
  booking_id: number
  companion_id: number | null
  incident_type: string
  severity: string
  status: string
  description: string | null
  notification_status: string
  acknowledged_at: string | null
  resolved_at: string | null
  resolution_code: string | null
  created_at: string
}

export async function insertIncident(row: Record<string, unknown>): Promise<IncidentRow> {
  const { data, error } = await supabaseAdmin
    .from('care_incidents').insert(row).select('*').single()
  raise(error as any)
  return data as IncidentRow
}

export async function getIncident(id: number): Promise<IncidentRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_incidents').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as IncidentRow) || null
}

export async function updateIncident(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_incidents').update(patch).eq('id', id)
  raise(error as any)
}

export async function listIncidents(status?: string): Promise<IncidentRow[]> {
  let q = supabaseAdmin.from('care_incidents').select('*')
    .order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as IncidentRow[]
}

export async function listIncidentsForBooking(bookingId: number): Promise<IncidentRow[]> {
  const { data, error } = await supabaseAdmin.from('care_incidents').select('*')
    .eq('booking_id', bookingId).order('created_at', { ascending: false })
  raise(error as any)
  return (data || []) as IncidentRow[]
}

// ── 家屬授權 ────────────────────────────────────────────────
export interface AuthRow {
  id: number
  booking_id: number
  user_id: string
  scope: string
  granted_at: string
  revoked_at: string | null
}

export async function listAuthorizationsForUser(userId: string, bookingId: number): Promise<AuthRow[]> {
  const { data, error } = await supabaseAdmin.from('care_service_authorizations')
    .select('*').eq('user_id', userId).eq('booking_id', bookingId)
  raise(error as any)
  return (data || []) as AuthRow[]
}

export async function listAuthorizationsForBooking(bookingId: number): Promise<AuthRow[]> {
  const { data, error } = await supabaseAdmin.from('care_service_authorizations')
    .select('*').eq('booking_id', bookingId).order('granted_at', { ascending: false })
  raise(error as any)
  return (data || []) as AuthRow[]
}

export async function upsertAuthorization(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_service_authorizations')
    .upsert(row, { onConflict: 'booking_id,user_id,scope' })
  raise(error as any)
}

export async function revokeAuthorization(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_service_authorizations').update(patch).eq('id', id)
  raise(error as any)
}

// ── 結算 ────────────────────────────────────────────────────
export interface SettlementLineRow {
  id: number
  booking_id: number
  companion_id: number
  batch_id: number | null
  employment_type_snapshot: string
  line_type: string
  amount: number
  currency: string
  basis_snapshot: string
  reason_code: string | null
  status: string
  review_note: string | null
  created_at: string
}

export interface SettlementBatchRow {
  id: number
  batch_no: string
  period_start: string
  period_end: string
  status: string
  approved_at: string | null
  published_at: string | null
  closed_at: string | null
  created_at: string
}

export async function insertSettlementLine(row: Record<string, unknown>): Promise<SettlementLineRow> {
  const { data, error } = await supabaseAdmin
    .from('care_settlement_lines').insert(row).select('*').single()
  raise(error as any)
  return data as SettlementLineRow
}

export async function getSettlementLine(id: number): Promise<SettlementLineRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_settlement_lines').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as SettlementLineRow) || null
}

export async function findLineByBookingAndType(bookingId: number, lineType: string): Promise<SettlementLineRow | null> {
  const { data, error } = await supabaseAdmin.from('care_settlement_lines').select('*')
    .eq('booking_id', bookingId).eq('line_type', lineType).maybeSingle()
  raise(error as any)
  return (data as SettlementLineRow) || null
}

export async function updateSettlementLine(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_settlement_lines').update(patch).eq('id', id)
  raise(error as any)
}

export async function listSettlementLines(status?: string): Promise<SettlementLineRow[]> {
  let q = supabaseAdmin.from('care_settlement_lines').select('*')
    .order('created_at', { ascending: false }).limit(300)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as SettlementLineRow[]
}

/** 陪診員端：只回自己已發布的明細 */
export async function listPublishedLinesForCompanion(companionId: number): Promise<SettlementLineRow[]> {
  const { data, error } = await supabaseAdmin.from('care_settlement_lines')
    .select('id, booking_id, line_type, amount, currency, basis_snapshot, status, created_at')
    .eq('companion_id', companionId).eq('status', 'published_to_staff')
    .order('created_at', { ascending: false }).limit(200)
  raise(error as any)
  return (data || []) as SettlementLineRow[]
}

export async function insertBatch(row: Record<string, unknown>): Promise<SettlementBatchRow> {
  const { data, error } = await supabaseAdmin
    .from('care_settlement_batches').insert(row).select('*').single()
  raise(error as any)
  return data as SettlementBatchRow
}

export async function getBatch(id: number): Promise<SettlementBatchRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_settlement_batches').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as SettlementBatchRow) || null
}

export async function updateBatch(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_settlement_batches').update(patch).eq('id', id)
  raise(error as any)
}

export async function listBatches(): Promise<SettlementBatchRow[]> {
  const { data, error } = await supabaseAdmin.from('care_settlement_batches').select('*')
    .order('created_at', { ascending: false }).limit(100)
  raise(error as any)
  return (data || []) as SettlementBatchRow[]
}

export async function attachLinesToBatch(batchId: number, lineIds: number[]): Promise<void> {
  if (lineIds.length === 0) return
  const { error } = await supabaseAdmin.from('care_settlement_lines')
    .update({ batch_id: batchId, status: 'batched' })
    .in('id', lineIds).eq('status', 'approved')
  raise(error as any)
}

export async function publishBatchLines(batchId: number): Promise<void> {
  const { error } = await supabaseAdmin.from('care_settlement_lines')
    .update({ status: 'published_to_staff' })
    .eq('batch_id', batchId).eq('status', 'batched')
  raise(error as any)
}

export async function listLinesForBatch(batchId: number): Promise<SettlementLineRow[]> {
  const { data, error } = await supabaseAdmin.from('care_settlement_lines').select('*')
    .eq('batch_id', batchId).order('created_at', { ascending: false })
  raise(error as any)
  return (data || []) as SettlementLineRow[]
}

// ── 控制台統計 ──────────────────────────────────────────────
export async function countBy(table: string, column: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from(table).select(column)
  raise(error as any)
  const out: Record<string, number> = {}
  for (const r of (data || []) as Record<string, string>[]) {
    const k = r[column]
    if (k) out[k] = (out[k] || 0) + 1
  }
  return out
}
