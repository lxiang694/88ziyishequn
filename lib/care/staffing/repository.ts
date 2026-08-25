/**
 * Sprint C 人力與媒合 Repository —— 唯一直接碰資料庫的一層。
 * React component 不得 import 這個檔案。
 */
import { supabaseAdmin } from '@/lib/supabase'
import { CareTableMissingError } from '../repository'
export { CareTableMissingError }

function raise(error: { code?: string; message: string } | null): void {
  if (!error) return
  if (error.code === '42P01' || error.code === '42883') throw new CareTableMissingError()
  throw new Error(error.message)
}

// ── 陪診員 ──────────────────────────────────────────────────
/** 名冊：刻意不回傳 password_hash、身分證、金融帳號等人事敏感欄位 */
const ROSTER_COLUMNS =
  'id, name, phone, gender, employment_type, status, completed_count, created_at'

export async function listCompanions(): Promise<Record<string, any>[]> {
  const { data, error } = await supabaseAdmin.from('companions')
    .select(ROSTER_COLUMNS).order('created_at', { ascending: false }).limit(300)
  raise(error as any)
  return (data || []) as Record<string, any>[]
}

export async function getCompanionBasic(id: number): Promise<Record<string, any> | null> {
  const { data, error } = await supabaseAdmin.from('companions')
    .select(ROSTER_COLUMNS + ', email, bio, certifications, admin_note')
    .eq('id', id).maybeSingle()
  raise(error as any)
  return (data as Record<string, any>) || null
}

// ── 僱用條件 ────────────────────────────────────────────────
export interface EmploymentTermRow {
  id: number; companion_id: number; employment_type: string; status: string
  effective_from: string; effective_to: string | null; note: string | null; created_at: string
}

export async function listEmploymentTerms(companionId: number): Promise<EmploymentTermRow[]> {
  const { data, error } = await supabaseAdmin.from('staff_employment_terms')
    .select('*').eq('companion_id', companionId).order('effective_from', { ascending: false })
  raise(error as any)
  return (data || []) as EmploymentTermRow[]
}

export async function getActiveEmploymentTerm(companionId: number): Promise<EmploymentTermRow | null> {
  const { data, error } = await supabaseAdmin.from('staff_employment_terms')
    .select('*').eq('companion_id', companionId).eq('status', 'active')
    .order('effective_from', { ascending: false }).limit(1)
  raise(error as any)
  const rows = (data || []) as EmploymentTermRow[]
  return rows[0] || null
}

export async function insertEmploymentTerm(row: Record<string, unknown>): Promise<EmploymentTermRow> {
  const { data, error } = await supabaseAdmin.from('staff_employment_terms')
    .insert(row).select('*').single()
  raise(error as any)
  return data as EmploymentTermRow
}

export async function updateEmploymentTerm(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_employment_terms').update(patch).eq('id', id)
  raise(error as any)
}

/** 缺僱用條件的人：backfill 後仍需人工處理的名單 */
export async function listCompanionsMissingEmployment(): Promise<Record<string, any>[]> {
  const { data: terms, error: e1 } = await supabaseAdmin
    .from('staff_employment_terms').select('companion_id')
  raise(e1 as any)
  const have = new Set((terms || []).map((t: any) => t.companion_id))
  const all = await listCompanions()
  return all.filter(c => !have.has(c.id))
}

// ── 服務區域 ────────────────────────────────────────────────
export async function listRegions(companionId: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('staff_service_regions')
    .select('region').eq('companion_id', companionId).order('region')
  raise(error as any)
  return (data || []).map((r: any) => r.region as string)
}

export async function listRegionsForMany(ids: number[]): Promise<Record<number, string[]>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabaseAdmin.from('staff_service_regions')
    .select('companion_id, region').in('companion_id', ids)
  raise(error as any)
  const out: Record<number, string[]> = {}
  for (const r of (data || []) as any[]) (out[r.companion_id] ||= []).push(r.region)
  return out
}

export async function addRegion(companionId: number, region: string, adminId: number): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_service_regions')
    .upsert({ companion_id: companionId, region, created_by_admin_id: adminId },
      { onConflict: 'companion_id,region' })
  raise(error as any)
}

export async function removeRegion(companionId: number, region: string): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_service_regions')
    .delete().eq('companion_id', companionId).eq('region', region)
  raise(error as any)
}

// ── 能力驗證 ────────────────────────────────────────────────
export interface VerificationRow {
  id: number; companion_id: number; capability_code: string; status: string
  verified_at: string; expires_at: string | null; note: string | null
}

export async function listCapabilities(): Promise<Record<string, any>[]> {
  const { data, error } = await supabaseAdmin.from('staff_capabilities')
    .select('*').order('sort_order')
  raise(error as any)
  return (data || []) as Record<string, any>[]
}

export async function listVerifications(companionId: number): Promise<VerificationRow[]> {
  const { data, error } = await supabaseAdmin.from('staff_capability_verifications')
    .select('*').eq('companion_id', companionId)
  raise(error as any)
  return (data || []) as VerificationRow[]
}

export async function listVerificationsForMany(ids: number[]): Promise<Record<number, VerificationRow[]>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabaseAdmin.from('staff_capability_verifications')
    .select('*').in('companion_id', ids)
  raise(error as any)
  const out: Record<number, VerificationRow[]> = {}
  for (const r of (data || []) as VerificationRow[]) (out[r.companion_id] ||= []).push(r)
  return out
}

export async function upsertVerification(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_capability_verifications')
    .upsert(row, { onConflict: 'companion_id,capability_code' })
  raise(error as any)
}

export async function setVerificationStatus(
  companionId: number, code: string, status: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_capability_verifications')
    .update({ status }).eq('companion_id', companionId).eq('capability_code', code)
  raise(error as any)
}

// ── 可服務時段 ──────────────────────────────────────────────
export interface AvailabilityRuleRow {
  id: number; companion_id: number; weekday: number
  start_time: string; end_time: string; region: string | null; active: boolean
}

export async function listAvailabilityRules(companionId: number): Promise<AvailabilityRuleRow[]> {
  const { data, error } = await supabaseAdmin.from('staff_availability_rules')
    .select('*').eq('companion_id', companionId).order('weekday').order('start_time')
  raise(error as any)
  return (data || []) as AvailabilityRuleRow[]
}

export async function listActiveWeekdaysForMany(ids: number[]): Promise<Record<number, number[]>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabaseAdmin.from('staff_availability_rules')
    .select('companion_id, weekday').in('companion_id', ids).eq('active', true)
  raise(error as any)
  const out: Record<number, number[]> = {}
  for (const r of (data || []) as any[]) {
    (out[r.companion_id] ||= []).push(r.weekday)
  }
  return out
}

export async function insertAvailabilityRule(row: Record<string, unknown>): Promise<AvailabilityRuleRow> {
  const { data, error } = await supabaseAdmin.from('staff_availability_rules')
    .insert(row).select('*').single()
  raise(error as any)
  return data as AvailabilityRuleRow
}

export async function getAvailabilityRule(id: number): Promise<AvailabilityRuleRow | null> {
  const { data, error } = await supabaseAdmin.from('staff_availability_rules')
    .select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as AvailabilityRuleRow) || null
}

export async function updateAvailabilityRule(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_availability_rules').update(patch).eq('id', id)
  raise(error as any)
}

// ── 請假 ────────────────────────────────────────────────────
export interface TimeOffRow {
  id: number; companion_id: number; request_type: string
  start_date: string; end_date: string; reason_code: string; note: string | null
  status: string; review_note: string | null; created_at: string
}

export async function listTimeOff(companionId: number): Promise<TimeOffRow[]> {
  const { data, error } = await supabaseAdmin.from('staff_time_off_requests')
    .select('*').eq('companion_id', companionId).order('start_date', { ascending: false })
  raise(error as any)
  return (data || []) as TimeOffRow[]
}

export async function listTimeOffByStatus(status?: string): Promise<TimeOffRow[]> {
  let q = supabaseAdmin.from('staff_time_off_requests').select('*')
    .order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as TimeOffRow[]
}

export async function listApprovedTimeOffForMany(ids: number[]): Promise<Record<number, TimeOffRow[]>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabaseAdmin.from('staff_time_off_requests')
    .select('*').in('companion_id', ids).eq('status', 'approved')
  raise(error as any)
  const out: Record<number, TimeOffRow[]> = {}
  for (const r of (data || []) as TimeOffRow[]) (out[r.companion_id] ||= []).push(r)
  return out
}

export async function insertTimeOff(row: Record<string, unknown>): Promise<TimeOffRow> {
  const { data, error } = await supabaseAdmin.from('staff_time_off_requests')
    .insert(row).select('*').single()
  raise(error as any)
  return data as TimeOffRow
}

export async function getTimeOff(id: number): Promise<TimeOffRow | null> {
  const { data, error } = await supabaseAdmin.from('staff_time_off_requests')
    .select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as TimeOffRow) || null
}

export async function updateTimeOff(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('staff_time_off_requests').update(patch).eq('id', id)
  raise(error as any)
}

// ── 邀請 ────────────────────────────────────────────────────
export interface ProposalRow {
  id: number; booking_id: number; care_case_id: number | null; companion_id: number
  status: string; expires_at: string; responded_at: string | null
  decline_reason_code: string | null; created_at: string
}

export async function insertProposal(row: Record<string, unknown>): Promise<ProposalRow> {
  const { data, error } = await supabaseAdmin.from('care_dispatch_proposals')
    .insert(row).select('*').single()
  raise(error as any)
  return data as ProposalRow
}

export async function getProposal(id: number): Promise<ProposalRow | null> {
  const { data, error } = await supabaseAdmin.from('care_dispatch_proposals')
    .select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as ProposalRow) || null
}

export async function updateProposal(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_dispatch_proposals').update(patch).eq('id', id)
  raise(error as any)
}

export async function listProposals(status?: string): Promise<ProposalRow[]> {
  let q = supabaseAdmin.from('care_dispatch_proposals').select('*')
    .order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as ProposalRow[]
}

export async function listOwnOpenProposals(companionId: number): Promise<ProposalRow[]> {
  const { data, error } = await supabaseAdmin.from('care_dispatch_proposals')
    .select('*').eq('companion_id', companionId).eq('status', 'proposed')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  raise(error as any)
  return (data || []) as ProposalRow[]
}

/** 當天已有的正式指派或未回覆邀請數，用於衝突檢查 */
export async function countConflicts(companionId: number, serviceDate: string): Promise<number> {
  const { count: assigned, error: e1 } = await supabaseAdmin.from('care_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('companion_id', companionId).eq('service_date', serviceDate)
    .not('status', 'in', '("已取消")')
  raise(e1 as any)

  const { data: props, error: e2 } = await supabaseAdmin.from('care_dispatch_proposals')
    .select('booking_id').eq('companion_id', companionId).eq('status', 'proposed')
    .gt('expires_at', new Date().toISOString())
  raise(e2 as any)

  let openSameDay = 0
  const ids = (props || []).map((p: any) => p.booking_id)
  if (ids.length > 0) {
    const { data: bs, error: e3 } = await supabaseAdmin.from('care_bookings')
      .select('id').in('id', ids).eq('service_date', serviceDate)
    raise(e3 as any)
    openSameDay = (bs || []).length
  }
  return (assigned || 0) + openSameDay
}

// ── 服務與案件 ──────────────────────────────────────────────
export async function getBooking(id: number): Promise<Record<string, any> | null> {
  const { data, error } = await supabaseAdmin.from('care_bookings')
    .select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as Record<string, any>) || null
}

export async function updateBooking(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_bookings').update(patch).eq('id', id)
  raise(error as any)
}

export async function getCase(id: number): Promise<Record<string, any> | null> {
  const { data, error } = await supabaseAdmin.from('care_cases')
    .select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as Record<string, any>) || null
}

export async function updateCase(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_cases').update(patch).eq('id', id)
  raise(error as any)
}

export async function getIntake(id: number): Promise<Record<string, any> | null> {
  const { data, error } = await supabaseAdmin.from('care_intakes')
    .select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as Record<string, any>) || null
}

/** 待媒合：ready_to_match 的案件 */
export async function listMatchableCases(): Promise<Record<string, any>[]> {
  const { data, error } = await supabaseAdmin.from('care_cases')
    .select('*').eq('status', 'ready_to_match').order('created_at', { ascending: true }).limit(100)
  raise(error as any)
  return (data || []) as Record<string, any>[]
}

export async function insertBooking(row: Record<string, unknown>): Promise<Record<string, any>> {
  const { data, error } = await supabaseAdmin.from('care_bookings')
    .insert(row).select('*').single()
  raise(error as any)
  return data as Record<string, any>
}

/** 未指派的正式服務（媒合對象） */
export async function listUnassignedBookings(): Promise<Record<string, any>[]> {
  const { data, error } = await supabaseAdmin.from('care_bookings')
    .select('id, booking_no, service_date, time_slot, county, hospital, service_name, mobility, status, companion_id')
    .is('companion_id', null)
    .not('status', 'in', '("已取消","已完成")')
    .order('service_date', { ascending: true }).limit(100)
  raise(error as any)
  return (data || []) as Record<string, any>[]
}

/**
 * 接受邀請：呼叫資料庫函式，把「檢查 + 指派」放在同一個交易裡。
 * 兩位兼職同時按下接受時，靠函式內的 row lock 保證最多一個成功。
 */
export async function callAcceptProposal(
  proposalId: number, companionId: number,
): Promise<{ ok: boolean; reason: string; out_booking_id: number | null }> {
  const { data, error } = await supabaseAdmin.rpc('care_accept_dispatch_proposal', {
    p_proposal_id: proposalId, p_companion_id: companionId,
  })
  raise(error as any)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, reason: 'proposal_not_found', out_booking_id: null }
  return row as { ok: boolean; reason: string; out_booking_id: number | null }
}

/** 逾時清理：把過期的邀請標記為 expired */
export async function expireStaleProposals(): Promise<number> {
  const { data, error } = await supabaseAdmin.from('care_dispatch_proposals')
    .update({ status: 'expired' })
    .eq('status', 'proposed').lt('expires_at', new Date().toISOString())
    .select('id')
  raise(error as any)
  return (data || []).length
}
