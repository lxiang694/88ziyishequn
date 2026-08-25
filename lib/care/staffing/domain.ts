/**
 * Sprint C 人力與媒合領域模型 —— 純函式，無 I/O，可直接單元測試。
 *
 * 對應：StaffProfile → companions，Assignment → care_bookings.companion_id。
 * 「兼職邀請」（proposal）與「正式指派」（Assignment）是兩件事，
 * 只有接受成功才會設定 companion_id。
 */
import { CareRuleError, CareInputError, canTransition, assertTransition } from '../domain'
export { CareRuleError, CareInputError, canTransition, assertTransition }

// ── 僱用型態 ────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = ['full_time', 'part_time'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const EMPLOYMENT_STATUSES = ['active', 'paused', 'ended'] as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

/** 舊 companions.employment_type 只有這兩個值，對應明確 */
export function normalizeLegacyEmploymentType(v: string | null | undefined): EmploymentType | null {
  if (v === 'fulltime') return 'full_time'
  if (v === 'parttime') return 'part_time'
  return null
}

export function isEmploymentActive(
  term: { status: string; effective_from: string; effective_to: string | null } | null | undefined,
  onDate: string,
): boolean {
  if (!term) return false
  if (term.status !== 'active') return false
  if (term.effective_from > onDate) return false
  if (term.effective_to && term.effective_to < onDate) return false
  return true
}

/** 同一人的有效期間不可重疊 */
export function periodsOverlap(
  a: { from: string; to: string | null },
  b: { from: string; to: string | null },
): boolean {
  const aEnd = a.to ?? '9999-12-31'
  const bEnd = b.to ?? '9999-12-31'
  return a.from <= bEnd && b.from <= aEnd
}

// ── 能力 ────────────────────────────────────────────────────
export const CAPABILITY_CODES = [
  'general_outpatient_flow',
  'wheelchair_route_support',
  'dementia_communication',
  'post_procedure_discharge_protocol',
] as const
export type CapabilityCode = (typeof CAPABILITY_CODES)[number]

export const VERIFICATION_STATUSES = ['verified', 'expired', 'suspended'] as const

export interface VerificationRow {
  capability_code: string
  status: string
  expires_at: string | null
}

export function hasVerifiedCapability(
  rows: readonly VerificationRow[] | null | undefined,
  code: string,
  onDate: string,
): boolean {
  if (!Array.isArray(rows)) return false
  return rows.some(r =>
    r.capability_code === code &&
    r.status === 'verified' &&
    (!r.expires_at || r.expires_at >= onDate))
}

/** 依就醫情境推出必要能力；情境代碼沿用 Sprint B */
export const SCENARIO_REQUIRED_CAPABILITIES: Record<string, CapabilityCode[]> = {
  routine_visit: ['general_outpatient_flow'],
  visit_with_tests: ['general_outpatient_flow'],
  multi_department_or_full_day: ['general_outpatient_flow'],
  post_procedure_discharge: ['general_outpatient_flow', 'post_procedure_discharge_protocol'],
  unsure: ['general_outpatient_flow'],
}

export function requiredCapabilitiesFor(scenario: string, mobility?: string | null): CapabilityCode[] {
  const base = SCENARIO_REQUIRED_CAPABILITIES[scenario] || ['general_outpatient_flow']
  const out = [...base]
  if (mobility === 'wheelchair' && !out.includes('wheelchair_route_support')) {
    out.push('wheelchair_route_support')
  }
  return out
}

// ── 請假 ────────────────────────────────────────────────────
export const TIME_OFF_TYPES = ['leave', 'unavailable'] as const
export const TIME_OFF_STATUSES = ['submitted', 'approved', 'rejected', 'cancelled'] as const
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number]

export const TIME_OFF_TRANSITIONS: Record<TimeOffStatus, TimeOffStatus[]> = {
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
}

export const TIME_OFF_REASON_CODES = [
  'personal', 'family', 'sick', 'training', 'other_unavailable',
] as const

export function coversDate(
  rows: readonly { start_date: string; end_date: string; status: string }[] | null | undefined,
  date: string,
): boolean {
  if (!Array.isArray(rows)) return false
  return rows.some(r => r.status === 'approved' && r.start_date <= date && r.end_date >= date)
}

// ── 邀請 ────────────────────────────────────────────────────
export const PROPOSAL_STATUSES = ['proposed', 'accepted', 'declined', 'expired', 'cancelled'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  proposed: ['accepted', 'declined', 'expired', 'cancelled'],
  accepted: [],
  declined: [],
  expired: [],
  cancelled: [],
}

export const DECLINE_REASON_CODES = [
  'schedule_conflict', 'too_far', 'not_confident_with_case', 'personal_reason', 'other',
] as const

/** 只有這個狀態的邀請還能回覆，且必須未逾時 */
export function isProposalOpen(
  p: { status: string; expires_at: string },
  now: Date = new Date(),
): boolean {
  return p.status === 'proposed' && new Date(p.expires_at).getTime() > now.getTime()
}

/**
 * 兼職在「尚未接受」時只能看到去敏感化摘要。
 *
 * 這個函式是唯一的白名單來源：接受前絕不回傳就診人姓名、電話、
 * 完整地址、樓層、報價、付款、初評備註或任何病況。
 */
export interface BookingLike {
  id: number
  service_date: string
  time_slot?: string | null
  county?: string | null
  hospital?: string | null
  service_name?: string | null
  patient_name?: string
  contact_name?: string
  contact_phone?: string
  contact_line?: string | null
  notes?: string | null
  price?: number | null
  companion_fee?: number | null
  pickup_address?: string | null
  department?: string | null
  mobility?: string | null
  [k: string]: unknown
}

export interface ProposalSummary {
  proposal_id: number
  service_date: string
  time_slot: string | null
  county: string | null
  service_name: string | null
  mobility: string | null
  required_capabilities: string[]
  expires_at: string
}

export function toProposalSummary(
  proposal: { id: number; expires_at: string },
  booking: BookingLike,
  requiredCapabilities: string[],
): ProposalSummary {
  return {
    proposal_id: proposal.id,
    service_date: booking.service_date,
    time_slot: booking.time_slot ?? null,
    // 只給縣市，不給醫院名稱與樓層 —— 接受後才隨正式工單提供
    county: booking.county ?? null,
    service_name: booking.service_name ?? null,
    mobility: booking.mobility ?? null,
    required_capabilities: requiredCapabilities,
    expires_at: proposal.expires_at,
  }
}

// ── 媒合檢查 ────────────────────────────────────────────────
export const MATCH_FAILURE_CODES = [
  'staff_inactive',
  'employment_inactive',
  'employment_type_mismatch',
  'region_mismatch',
  'capability_not_verified',
  'time_off_approved',
  'schedule_conflict',
  'availability_mismatch',
  'already_assigned',
  'case_not_matchable',
] as const
export type MatchFailureCode = (typeof MATCH_FAILURE_CODES)[number]

export const MATCH_FAILURE_MESSAGES: Record<MatchFailureCode, string> = {
  staff_inactive: '陪診員帳號未啟用',
  employment_inactive: '沒有有效的僱用條件，或已暫停接案',
  employment_type_mismatch: '僱用型態不符（全職走正式指派、兼職走邀請）',
  region_mismatch: '服務區域不符',
  capability_not_verified: '必要能力尚未驗證或已過期',
  time_off_approved: '當天已核准請假／暫停接案',
  schedule_conflict: '當天已有其他服務或未回覆的邀請',
  availability_mismatch: '當天不在可服務時段內',
  already_assigned: '這筆服務已經指派給其他人',
  case_not_matchable: '這個案件目前不是可媒合狀態',
}

export interface MatchCandidateInput {
  companion_status: string
  employment: { status: string; employment_type: string; effective_from: string; effective_to: string | null } | null
  regions: readonly string[]
  verifications: readonly VerificationRow[]
  timeOff: readonly { start_date: string; end_date: string; status: string }[]
  /** 當天已有的正式指派或未回覆邀請數 */
  conflictingCount: number
  availabilityWeekdays?: readonly number[] | null
}

export interface MatchContext {
  serviceDate: string
  weekday: number
  county: string | null
  requiredCapabilities: readonly string[]
  wantEmploymentType: EmploymentType
  bookingAssigned: boolean
}

/**
 * 回傳所有不符合的原因（不是只回第一個）——
 * 讓派工人員一次看到全部問題，而不是修一個才發現下一個。
 */
export function evaluateMatch(
  c: MatchCandidateInput, ctx: MatchContext,
): { ok: boolean; failures: MatchFailureCode[] } {
  const f: MatchFailureCode[] = []

  if (ctx.bookingAssigned) f.push('already_assigned')
  if (c.companion_status !== 'active') f.push('staff_inactive')

  if (!isEmploymentActive(c.employment, ctx.serviceDate)) {
    f.push('employment_inactive')
  } else if (c.employment!.employment_type !== ctx.wantEmploymentType) {
    f.push('employment_type_mismatch')
  }

  if (ctx.county && !c.regions.includes(ctx.county)) f.push('region_mismatch')

  for (const cap of ctx.requiredCapabilities) {
    if (!hasVerifiedCapability(c.verifications, cap, ctx.serviceDate)) {
      f.push('capability_not_verified')
      break
    }
  }

  if (coversDate(c.timeOff, ctx.serviceDate)) f.push('time_off_approved')
  if (c.conflictingCount > 0) f.push('schedule_conflict')

  // 週期性時段只對兼職做硬性檢查；全職以公司班表為準
  if (ctx.wantEmploymentType === 'part_time'
      && Array.isArray(c.availabilityWeekdays)
      && c.availabilityWeekdays.length > 0
      && !c.availabilityWeekdays.includes(ctx.weekday)) {
    f.push('availability_mismatch')
  }

  return { ok: f.length === 0, failures: f }
}

export function assertMatchable(r: { ok: boolean; failures: MatchFailureCode[] }): void {
  if (r.ok) return
  const msg = r.failures.map(c => MATCH_FAILURE_MESSAGES[c]).join('；')
  throw new CareRuleError(`無法指派：${msg}`)
}

// ── 可服務時段衝突 ──────────────────────────────────────────
export function rulesOverlap(
  a: { weekday: number; start_time: string; end_time: string },
  b: { weekday: number; start_time: string; end_time: string },
): boolean {
  if (a.weekday !== b.weekday) return false
  return a.start_time < b.end_time && b.start_time < a.end_time
}

// ── 權限 ────────────────────────────────────────────────────
export const STAFFING_PERMISSION_KEYS = {
  staff: 'care_staff.manage',
  schedule: 'care_schedule.manage',
  dispatch: 'care_dispatch.manage',
  credential: 'care_staff_credential.manage',
  timeOff: 'care_staff_time_off.review',
} as const

export const ALL_STAFFING_PERMISSIONS: string[] = Object.values(STAFFING_PERMISSION_KEYS)
