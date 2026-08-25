/**
 * Sprint C 人力與媒合 Service —— 固定 use case，沒有泛用 PATCH。
 *
 * 關鍵原則：
 *  - proposal ≠ Assignment。只有接受成功才設定 care_bookings.companion_id。
 *  - 接受的並發保護在資料庫函式裡，不在應用層。
 *  - 陪診員不能改自己的僱用型態、能力驗證，也碰不到他人資料。
 */
import {
  PROPOSAL_TRANSITIONS, TIME_OFF_TRANSITIONS,
  assertTransition, evaluateMatch, assertMatchable, isProposalOpen,
  requiredCapabilitiesFor, toProposalSummary, rulesOverlap, coversDate,
  normalizeLegacyEmploymentType, isEmploymentActive,
  MATCH_FAILURE_MESSAGES, CareRuleError, CareInputError,
  type ProposalStatus, type TimeOffStatus, type EmploymentType, type MatchFailureCode,
} from './domain'
import * as repo from './repository'
import type {
  EmploymentTermInput, VerifyCapabilityInput, AvailabilityRuleInput, TimeOffInput,
} from './validation'

export interface ActorAdmin { id: number; name: string; account: string }
export interface ActorStaff { id: number; name: string }

const TW_OFFSET = 8 * 3600 * 1000
const todayTW = () => new Date(Date.now() + TW_OFFSET).toISOString().slice(0, 10)
const weekdayOf = (isoDate: string) => new Date(`${isoDate}T00:00:00+08:00`).getUTCDay()

// ══════════ 1. 僱用條件 ══════════
export async function createStaffEmploymentTerm(
  companionId: number, input: EmploymentTermInput, actor: ActorAdmin,
) {
  const existing = await repo.getActiveEmploymentTerm(companionId)
  if (existing) {
    throw new CareRuleError('這位陪診員已有有效的僱用條件，請先結束舊條件再建立新的')
  }
  const row = await repo.insertEmploymentTerm({
    companion_id: companionId,
    employment_type: input.employment_type,
    status: 'active',
    effective_from: input.effective_from,
    effective_to: input.effective_to,
    note: input.note,
    created_by_admin_id: actor.id,
  })
  // 同步既有欄位，讓舊頁面與既有查詢不會失準
  await syncLegacyEmploymentType(companionId, input.employment_type)
  return { termId: row.id }
}

export async function endStaffEmploymentTerm(termId: number, endDate: string, actor: ActorAdmin) {
  await repo.updateEmploymentTerm(termId, {
    status: 'ended', effective_to: endDate, ended_by_admin_id: actor.id,
  })
  return { termId }
}

export async function pauseStaffEmploymentTerm(termId: number, actor: ActorAdmin) {
  await repo.updateEmploymentTerm(termId, { status: 'paused', ended_by_admin_id: actor.id })
  return { termId }
}

export async function resumeStaffEmploymentTerm(termId: number, actor: ActorAdmin) {
  await repo.updateEmploymentTerm(termId, { status: 'active' })
  return { termId }
}

/** companions.employment_type 仍被既有頁面使用，保持一致 */
async function syncLegacyEmploymentType(companionId: number, t: EmploymentType) {
  const legacy = t === 'full_time' ? 'fulltime' : 'parttime'
  const { supabaseAdmin } = await import('@/lib/supabase')
  await supabaseAdmin.from('companions').update({ employment_type: legacy }).eq('id', companionId)
}

// ══════════ 2. 服務區域 ══════════
export async function addStaffServiceRegion(companionId: number, region: string, actor: ActorAdmin) {
  await repo.addRegion(companionId, region, actor.id)
  return { companionId, region }
}

export async function removeStaffServiceRegion(companionId: number, region: string, actor: ActorAdmin) {
  await repo.removeRegion(companionId, region)
  return { companionId, region }
}

// ══════════ 3. 能力驗證 ══════════
/** 陪診員自己不能呼叫這個 —— Route Handler 要求 care_staff_credential.manage */
export async function verifyStaffCapability(
  companionId: number, input: VerifyCapabilityInput, actor: ActorAdmin,
) {
  await repo.upsertVerification({
    companion_id: companionId,
    capability_code: input.capability_code,
    status: 'verified',
    verified_at: new Date().toISOString(),
    expires_at: input.expires_at,
    verified_by_admin_id: actor.id,
    note: input.note,
  })
  return { companionId, code: input.capability_code }
}

export async function expireStaffCapabilityVerification(
  companionId: number, code: string, actor: ActorAdmin,
) {
  await repo.setVerificationStatus(companionId, code, 'expired')
  return { companionId, code }
}

export async function suspendStaffCapabilityVerification(
  companionId: number, code: string, actor: ActorAdmin,
) {
  await repo.setVerificationStatus(companionId, code, 'suspended')
  return { companionId, code }
}

// ══════════ 4. 可服務時段（本人）══════════
async function assertNoAvailabilityConflict(
  companionId: number, rule: AvailabilityRuleInput, excludeId?: number,
) {
  const existing = await repo.listAvailabilityRules(companionId)
  const clash = existing.find(r =>
    r.active && r.id !== excludeId &&
    rulesOverlap(
      { weekday: r.weekday, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) },
      rule))
  if (clash) {
    throw new CareRuleError('這個時段與您已設定的另一個時段重疊，請先調整或停用原本的時段')
  }
}

export async function setOwnAvailabilityRule(input: AvailabilityRuleInput, actor: ActorStaff) {
  await assertNoAvailabilityConflict(actor.id, input)
  const row = await repo.insertAvailabilityRule({
    companion_id: actor.id,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
    region: input.region,
    active: true,
  })
  return { ruleId: row.id }
}

export async function updateOwnAvailabilityRule(
  ruleId: number, input: AvailabilityRuleInput, actor: ActorStaff,
) {
  const r = await repo.getAvailabilityRule(ruleId)
  if (!r) throw new CareRuleError('找不到這個時段')
  if (r.companion_id !== actor.id) throw new CareRuleError('這不是您的時段設定')
  await assertNoAvailabilityConflict(actor.id, input, ruleId)
  await repo.updateAvailabilityRule(ruleId, {
    weekday: input.weekday, start_time: input.start_time,
    end_time: input.end_time, region: input.region,
  })
  return { ruleId }
}

export async function disableOwnAvailabilityRule(ruleId: number, actor: ActorStaff) {
  const r = await repo.getAvailabilityRule(ruleId)
  if (!r) throw new CareRuleError('找不到這個時段')
  if (r.companion_id !== actor.id) throw new CareRuleError('這不是您的時段設定')
  await repo.updateAvailabilityRule(ruleId, { active: false })
  return { ruleId }
}

export async function getOwnAvailability(actor: ActorStaff) {
  return repo.listAvailabilityRules(actor.id)
}

// ══════════ 5. 請假 ══════════
export async function submitOwnTimeOffRequest(input: TimeOffInput, actor: ActorStaff) {
  const row = await repo.insertTimeOff({
    companion_id: actor.id,
    request_type: input.request_type,
    start_date: input.start_date,
    end_date: input.end_date,
    reason_code: input.reason_code,
    note: input.note,
    status: 'submitted',
  })
  return { requestId: row.id }
}

export async function cancelOwnTimeOffRequest(id: number, actor: ActorStaff) {
  const r = await repo.getTimeOff(id)
  if (!r) throw new CareRuleError('找不到這筆申請')
  if (r.companion_id !== actor.id) throw new CareRuleError('這不是您的申請')
  assertTransition(TIME_OFF_TRANSITIONS, r.status as TimeOffStatus, 'cancelled', '請假申請')
  await repo.updateTimeOff(id, { status: 'cancelled' })
  return { from: r.status, to: 'cancelled' as const }
}

export async function reviewStaffTimeOffRequest(
  id: number, decision: 'approve' | 'reject', note: string | null, actor: ActorAdmin,
) {
  const r = await repo.getTimeOff(id)
  if (!r) throw new CareRuleError('找不到這筆申請')
  const to: TimeOffStatus = decision === 'approve' ? 'approved' : 'rejected'
  assertTransition(TIME_OFF_TRANSITIONS, r.status as TimeOffStatus, to, '請假申請')

  if (decision === 'approve') {
    // 已核准的期間內若已有正式服務，不可靜默覆蓋
    const conflicts = await countAssignedInRange(r.companion_id, r.start_date, r.end_date)
    if (conflicts > 0) {
      throw new CareRuleError(
        `這段期間已有 ${conflicts} 筆已指派的服務。請先依既有流程取消或換人，再核准請假。`)
    }
  }

  await repo.updateTimeOff(id, {
    status: to, reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(), review_note: note,
  })
  return { from: r.status, to }
}

async function countAssignedInRange(companionId: number, from: string, to: string): Promise<number> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { count } = await supabaseAdmin.from('care_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('companion_id', companionId)
    .gte('service_date', from).lte('service_date', to)
    .not('status', 'in', '("已取消","已完成")')
  return count || 0
}

export async function getOwnTimeOff(actor: ActorStaff) {
  return repo.listTimeOff(actor.id)
}

// ══════════ 6. 案件 → 正式服務 ══════════
/**
 * 把 ready_to_match 的案件實體化成一筆未指派的正式服務。
 * 冪等：已經有 booking_id 就直接回。
 */
export async function materializeCareCaseBooking(caseId: number, actor: ActorAdmin) {
  const c = await repo.getCase(caseId)
  if (!c) throw new CareRuleError('找不到這個案件')
  if (c.booking_id) return { bookingId: c.booking_id as number, created: false }
  if (c.status !== 'ready_to_match') {
    throw new CareRuleError(`案件狀態為「${c.status}」，尚未可媒合`)
  }

  const intake = await repo.getIntake(c.intake_id as number)
  if (!intake) throw new CareRuleError('找不到對應的初評資料')

  const bookingNo = `CS${todayTW().replace(/-/g, '')}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const booking = await repo.insertBooking({
    booking_no: bookingNo,
    patient_name: intake.contact_name,
    contact_name: intake.contact_name,
    contact_phone: intake.contact_phone,
    contact_line: intake.contact_line_id,
    relation: intake.relationship_to_beneficiary,
    service_date: intake.scheduled_service_date,
    time_slot: intake.time_preference === 'unspecified' ? 'morning' : intake.time_preference,
    county: intake.county,
    hospital: intake.hospital_name,
    mobility: intake.mobility_support_level,
    status: '已付款',
    notes: intake.limited_support_note,
  })
  await repo.updateCase(caseId, { booking_id: booking.id })
  return { bookingId: booking.id as number, created: true }
}

// ══════════ 7. 媒合 ══════════
interface CandidateView {
  companion: Record<string, any>
  employmentType: string | null
  regions: string[]
  result: { ok: boolean; failures: MatchFailureCode[] }
  failureMessages: string[]
}

/**
 * 列出候選人並逐一評估。
 * 不符合的人也會列出來，並附上**所有**原因，方便派工人員判斷。
 */
export async function listDispatchCandidates(
  bookingId: number, wantType: EmploymentType,
): Promise<{ booking: Record<string, any>; candidates: CandidateView[] }> {
  const booking = await repo.getBooking(bookingId)
  if (!booking) throw new CareRuleError('找不到這筆服務')

  const companions = await repo.listCompanions()
  const ids = companions.map(c => c.id as number)
  const [regionMap, verMap, offMap, weekdayMap] = await Promise.all([
    repo.listRegionsForMany(ids),
    repo.listVerificationsForMany(ids),
    repo.listApprovedTimeOffForMany(ids),
    repo.listActiveWeekdaysForMany(ids),
  ])

  const serviceDate = booking.service_date as string
  const required = requiredCapabilitiesFor(
    (booking.service_code as string) || 'routine_visit', booking.mobility as string | null)

  const ctxBase = {
    serviceDate,
    weekday: weekdayOf(serviceDate),
    county: (booking.county as string) || null,
    requiredCapabilities: required,
    wantEmploymentType: wantType,
    bookingAssigned: !!booking.companion_id,
  }

  const candidates: CandidateView[] = []
  for (const c of companions) {
    const term = await repo.getActiveEmploymentTerm(c.id as number)
    const conflicts = await repo.countConflicts(c.id as number, serviceDate)
    const result = evaluateMatch({
      companion_status: c.status as string,
      employment: term,
      regions: regionMap[c.id as number] || [],
      verifications: verMap[c.id as number] || [],
      timeOff: offMap[c.id as number] || [],
      conflictingCount: conflicts,
      availabilityWeekdays: weekdayMap[c.id as number] || [],
    }, ctxBase)

    candidates.push({
      companion: { id: c.id, name: c.name, phone: c.phone, status: c.status },
      employmentType: term?.employment_type ?? null,
      regions: regionMap[c.id as number] || [],
      result,
      failureMessages: result.failures.map(f => MATCH_FAILURE_MESSAGES[f]),
    })
  }

  // 合格的排前面
  candidates.sort((a, b) => Number(b.result.ok) - Number(a.result.ok))
  return { booking, candidates }
}

/** 共用的媒合前檢查；全職指派與建立邀請都會跑一次 */
async function assertCanDispatch(
  bookingId: number, companionId: number, wantType: EmploymentType,
) {
  const booking = await repo.getBooking(bookingId)
  if (!booking) throw new CareRuleError('找不到這筆服務')

  const companion = await repo.getCompanionBasic(companionId)
  if (!companion) throw new CareRuleError('找不到這位陪診員')

  const serviceDate = booking.service_date as string
  const [term, regions, vers, offs, weekdays, conflicts] = await Promise.all([
    repo.getActiveEmploymentTerm(companionId),
    repo.listRegions(companionId),
    repo.listVerifications(companionId),
    repo.listApprovedTimeOffForMany([companionId]),
    repo.listActiveWeekdaysForMany([companionId]),
    repo.countConflicts(companionId, serviceDate),
  ])

  assertMatchable(evaluateMatch({
    companion_status: companion.status as string,
    employment: term,
    regions,
    verifications: vers,
    timeOff: offs[companionId] || [],
    conflictingCount: conflicts,
    availabilityWeekdays: weekdays[companionId] || [],
  }, {
    serviceDate,
    weekday: weekdayOf(serviceDate),
    county: (booking.county as string) || null,
    requiredCapabilities: requiredCapabilitiesFor(
      (booking.service_code as string) || 'routine_visit', booking.mobility as string | null),
    wantEmploymentType: wantType,
    bookingAssigned: !!booking.companion_id,
  }))

  return { booking, companion }
}

/** 全職：管理者直接建立正式指派（仍要通過全部檢查） */
export async function createFullTimeAssignment(
  bookingId: number, companionId: number, actor: ActorAdmin,
) {
  await assertCanDispatch(bookingId, companionId, 'full_time')
  await repo.updateBooking(bookingId, {
    companion_id: companionId, status: '已派工', updated_at: new Date().toISOString(),
  })
  return { bookingId, companionId }
}

/** 兼職：只能建立邀請，不可直接指派 */
export async function createPartTimeDispatchProposal(
  bookingId: number, companionId: number, expiresInHours: number, actor: ActorAdmin,
) {
  await assertCanDispatch(bookingId, companionId, 'part_time')
  const expires = new Date(Date.now() + expiresInHours * 3600_000).toISOString()
  const row = await repo.insertProposal({
    booking_id: bookingId,
    companion_id: companionId,
    status: 'proposed',
    expires_at: expires,
    created_by_admin_id: actor.id,
  })
  return { proposalId: row.id, expiresAt: expires }
}

export async function cancelDispatchProposal(id: number, actor: ActorAdmin) {
  const p = await repo.getProposal(id)
  if (!p) throw new CareRuleError('找不到這筆邀請')
  assertTransition(PROPOSAL_TRANSITIONS, p.status as ProposalStatus, 'cancelled', '服務邀請')
  await repo.updateProposal(id, { status: 'cancelled', responded_at: new Date().toISOString() })
  return { from: p.status, to: 'cancelled' as const }
}

export async function expireDispatchProposal(id: number, actor: ActorAdmin) {
  const p = await repo.getProposal(id)
  if (!p) throw new CareRuleError('找不到這筆邀請')
  assertTransition(PROPOSAL_TRANSITIONS, p.status as ProposalStatus, 'expired', '服務邀請')
  await repo.updateProposal(id, { status: 'expired' })
  return { from: p.status, to: 'expired' as const }
}

// ══════════ 8. 陪診員回覆邀請 ══════════
/**
 * 兼職在接受前只能看到去敏感化摘要。
 * 這裡回傳的內容一律經過 toProposalSummary() 白名單。
 */
export async function listOwnProposalSummaries(actor: ActorStaff) {
  const props = await repo.listOwnOpenProposals(actor.id)
  const out = []
  for (const p of props) {
    const b = await repo.getBooking(p.booking_id)
    if (!b) continue
    const required = requiredCapabilitiesFor(
      (b.service_code as string) || 'routine_visit', b.mobility as string | null)
    out.push(toProposalSummary(p, b as any, required))
  }
  return out
}

export async function acceptOwnDispatchProposal(proposalId: number, actor: ActorStaff) {
  const p = await repo.getProposal(proposalId)
  if (!p) throw new CareRuleError('找不到這筆邀請')
  if (p.companion_id !== actor.id) throw new CareRuleError('這不是給您的邀請')
  if (!isProposalOpen(p)) throw new CareRuleError('這筆邀請已經逾時或已被取消，無法再接受')

  // 檢查與指派都在資料庫函式的同一個交易裡完成
  const r = await repo.callAcceptProposal(proposalId, actor.id)
  if (!r.ok) {
    const messages: Record<string, string> = {
      proposal_not_found: '找不到這筆邀請',
      not_your_proposal: '這不是給您的邀請',
      proposal_not_open: '這筆邀請已經回覆過了',
      proposal_expired: '這筆邀請已經逾時',
      employment_inactive: '您目前沒有有效的接案資格，請聯絡客服',
      already_assigned: '這筆服務剛剛已經由其他陪診員接下了',
    }
    throw new CareRuleError(messages[r.reason] || '目前無法接受這筆邀請')
  }
  return { bookingId: r.out_booking_id! }
}

export async function declineOwnDispatchProposal(
  proposalId: number, reasonCode: string, note: string | null, actor: ActorStaff,
) {
  const p = await repo.getProposal(proposalId)
  if (!p) throw new CareRuleError('找不到這筆邀請')
  if (p.companion_id !== actor.id) throw new CareRuleError('這不是給您的邀請')
  assertTransition(PROPOSAL_TRANSITIONS, p.status as ProposalStatus, 'declined', '服務邀請')
  await repo.updateProposal(proposalId, {
    status: 'declined',
    decline_reason_code: reasonCode,
    decline_note: note,
    responded_at: new Date().toISOString(),
  })
  return { proposalId }
}

// ══════════ 9. 後台檢視 ══════════
export async function getStaffRoster() {
  const companions = await repo.listCompanions()
  const ids = companions.map(c => c.id as number)
  const [regionMap, verMap] = await Promise.all([
    repo.listRegionsForMany(ids),
    repo.listVerificationsForMany(ids),
  ])
  const today = todayTW()
  const out = []
  for (const c of companions) {
    const term = await repo.getActiveEmploymentTerm(c.id as number)
    const vers = verMap[c.id as number] || []
    out.push({
      ...c,
      employment_type: term?.employment_type ?? null,
      employment_status: term?.status ?? null,
      employment_missing: !term,
      regions: regionMap[c.id as number] || [],
      verified_count: vers.filter(v => v.status === 'verified'
        && (!v.expires_at || v.expires_at >= today)).length,
    })
  }
  return out
}

export async function getStaffDetail(companionId: number) {
  const companion = await repo.getCompanionBasic(companionId)
  if (!companion) throw new CareRuleError('找不到這位陪診員')
  const [terms, regions, verifications, rules, timeOff, capabilities] = await Promise.all([
    repo.listEmploymentTerms(companionId),
    repo.listRegions(companionId),
    repo.listVerifications(companionId),
    repo.listAvailabilityRules(companionId),
    repo.listTimeOff(companionId),
    repo.listCapabilities(),
  ])
  return { companion, terms, regions, verifications, rules, timeOff, capabilities }
}

export async function getScheduleOverview() {
  const companions = await repo.listCompanions()
  const ids = companions.map(c => c.id as number)
  const [weekdayMap, offMap] = await Promise.all([
    repo.listActiveWeekdaysForMany(ids),
    repo.listApprovedTimeOffForMany(ids),
  ])
  const out = []
  for (const c of companions) {
    const term = await repo.getActiveEmploymentTerm(c.id as number)
    out.push({
      id: c.id, name: c.name, status: c.status,
      employment_type: term?.employment_type ?? null,
      available_weekdays: [...new Set(weekdayMap[c.id as number] || [])].sort(),
      approved_time_off: (offMap[c.id as number] || []).map(o => ({
        start_date: o.start_date, end_date: o.end_date, request_type: o.request_type,
      })),
    })
  }
  return out
}

export async function getMissingEmploymentList() {
  return repo.listCompanionsMissingEmployment()
}
