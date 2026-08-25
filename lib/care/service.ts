/**
 * 陪診營運 Service —— 固定 use case，沒有泛用 PATCH。
 *
 * 每個 use case 自己檢查狀態轉換；資料庫 trigger 是第二道防線。
 * 呼叫端（Route Handler）負責身分與權限，Service 負責流程規則。
 */
import { createHash } from 'node:crypto'
import {
  CASE_TRANSITIONS, INTAKE_TRANSITIONS, QUOTE_TRANSITIONS,
  assertTransition, isQuoteFrozen, CareRuleError, CareInputError,
} from './domain'
import type { CaseStatus, IntakeStatus, QuoteStatus } from './domain'
import * as repo from './repository'
import {
  buildQuoteTotals, type PublicIntakeInput, type QuoteDraftInput,
} from './validation'

export interface ActorAdmin { id: number; name: string; account: string }

const INTAKE_RATE_LIMIT_PER_HOUR = 5

/** 只存 IP 的雜湊，且加上伺服器 salt，避免反查 */
export function hashIp(ip: string): string {
  const salt = process.env.CARE_INTAKE_IP_SALT || process.env.JWT_SECRET || 'care-intake'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 64)
}

// ── 1. 公開初評 ─────────────────────────────────────────────
/**
 * 匿名可呼叫，但：
 *  - 只寫入白名單欄位（status/source 由伺服器決定）
 *  - 以 IP 雜湊做每小時上限
 *  - 不回傳任何 internal id
 */
export async function createCareIntakeFromPublicRequest(
  input: PublicIntakeInput, clientIp: string,
): Promise<{ accepted: true }> {
  const ipHash = clientIp ? hashIp(clientIp) : null

  if (ipHash) {
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recent = await repo.countRecentIntakesByIpHash(ipHash, sinceIso)
    if (recent >= INTAKE_RATE_LIMIT_PER_HOUR) {
      throw new CareRuleError('送出次數過於頻繁，請稍後再試，或直接以 LINE 與我們聯繫')
    }
  }

  await repo.insertIntake({
    ...input,
    status: 'submitted',
    source: 'public_web',
    submitter_ip_hash: ipHash,
  })

  // 刻意不回傳 id：公開端不得取得 internal identifier
  return { accepted: true }
}

// ── 2. 初評審查 ─────────────────────────────────────────────
async function loadIntakeOrThrow(id: number) {
  const row = await repo.getIntake(id)
  if (!row) throw new CareRuleError('找不到這筆初評')
  return row
}

function move(from: IntakeStatus, to: IntakeStatus) {
  assertTransition(INTAKE_TRANSITIONS, from, to, '初評')
}

export async function startCareIntakeReview(id: number, actor: ActorAdmin) {
  const row = await loadIntakeOrThrow(id)
  move(row.status, 'in_review')
  await repo.updateIntake(id, {
    status: 'in_review',
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
  })
  return { from: row.status, to: 'in_review' as const }
}

export async function requestMoreCareIntakeInformation(
  id: number, reviewNote: string, actor: ActorAdmin,
) {
  const row = await loadIntakeOrThrow(id)
  move(row.status, 'needs_more_information')
  await repo.updateIntake(id, {
    status: 'needs_more_information',
    review_note: reviewNote,
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
  })
  return { from: row.status, to: 'needs_more_information' as const }
}

export async function declineCareIntake(
  id: number, reasonCode: string, reviewNote: string | null, actor: ActorAdmin,
) {
  const row = await loadIntakeOrThrow(id)
  move(row.status, 'declined')
  await repo.updateIntake(id, {
    status: 'declined',
    decline_reason_code: reasonCode,
    review_note: reviewNote,
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
  })
  return { from: row.status, to: 'declined' as const }
}

// ── 3. 轉為案件 ─────────────────────────────────────────────
function makeCaseNo(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `CC${d}${rand}`
}

export async function convertCareIntakeToCase(id: number, actor: ActorAdmin) {
  const row = await loadIntakeOrThrow(id)
  move(row.status, 'converted_to_case')

  const created = await repo.insertCase({
    case_no: makeCaseNo(),
    intake_id: id,
    status: 'needs_assessment',
    owner_admin_id: actor.id,
  })

  await repo.updateIntake(id, {
    status: 'converted_to_case',
    reviewed_by_admin_id: actor.id,
    reviewed_at: new Date().toISOString(),
  })

  return { caseId: created.id, caseNo: created.case_no }
}

// ── 4. 案件 ─────────────────────────────────────────────────
async function loadCaseOrThrow(id: number) {
  const row = await repo.getCase(id)
  if (!row) throw new CareRuleError('找不到這個案件')
  return row
}

export async function cancelCareCase(id: number, reasonCode: string, actor: ActorAdmin) {
  const row = await loadCaseOrThrow(id)
  assertTransition(CASE_TRANSITIONS, row.status, 'cancelled', '案件')
  await repo.updateCase(id, {
    status: 'cancelled',
    cancel_reason_code: reasonCode,
    cancelled_at: new Date().toISOString(),
    owner_admin_id: row.owner_admin_id ?? actor.id,
  })
  return { from: row.status, to: 'cancelled' as const }
}

/**
 * ⚠️ 這不是金流證明。
 * 本輪不串接任何付款、匯款核銷或對帳；這個動作只代表「有人在後台人工確認收到款項」。
 * 僅限具 care_case.manage 權限的後台帳號，且只能從 awaiting_payment 推進。
 */
export async function markCarePaymentReceived(id: number, actor: ActorAdmin) {
  const row = await loadCaseOrThrow(id)
  assertTransition(CASE_TRANSITIONS, row.status, 'ready_to_match', '案件')
  await repo.updateCase(id, {
    status: 'ready_to_match',
    payment_marked_by: actor.name || actor.account,
    payment_marked_at: new Date().toISOString(),
  })
  return { from: row.status, to: 'ready_to_match' as const }
}

// ── 5. 報價 ─────────────────────────────────────────────────
async function loadQuoteOrThrow(id: number) {
  const row = await repo.getQuote(id)
  if (!row) throw new CareRuleError('找不到這份報價')
  return row
}

function moveQuote(from: QuoteStatus, to: QuoteStatus) {
  assertTransition(QUOTE_TRANSITIONS, from, to, '報價')
}

/**
 * 建立報價草稿。
 * base_fee 與方案名稱一律從 care_services 取當下值做快照，
 * 總價由伺服器重算 —— client 傳來的任何金額欄位都不採用。
 */
export async function createCareQuoteDraft(
  caseId: number, input: QuoteDraftInput, actor: ActorAdmin,
) {
  const c = await loadCaseOrThrow(caseId)
  if (c.status === 'cancelled') throw new CareRuleError('已取消的案件不能再建立報價')

  const snapshot = await repo.getServiceSnapshot(input.service_code)
  if (!snapshot) throw new CareInputError('找不到這個服務方案，或方案已停用', 'service_code')

  const { total, lines } = buildQuoteTotals(input, snapshot.price)
  const version = await repo.nextQuoteVersion(caseId)

  const quote = await repo.insertQuote({
    care_case_id: caseId,
    version,
    status: 'draft',
    currency: 'TWD',
    service_code: input.service_code,
    service_name_snapshot: snapshot.name,
    base_fee: snapshot.price,
    travel_estimate_amount: input.travel_estimate_amount,
    travel_estimate_basis: input.travel_estimate_basis,
    overtime_rule_snapshot: input.overtime_rule_snapshot,
    total_estimate: total,
    valid_until: input.valid_until,
    created_by_admin_id: actor.id,
  })

  await repo.insertQuoteItems(lines.map(l => ({
    quote_id: quote.id,
    item_code: l.item_code,
    label_snapshot: l.label_snapshot,
    unit_price: l.unit_price,
    quantity: l.quantity,
    line_total: l.line_total,
  })))

  return { quoteId: quote.id, version, total }
}

/** 只有 draft 可以改，且一樣重新快照與重算 */
export async function updateCareQuoteDraft(
  quoteId: number, input: QuoteDraftInput, actor: ActorAdmin,
) {
  const q = await loadQuoteOrThrow(quoteId)
  if (q.status !== 'draft') {
    throw new CareRuleError(`狀態為「${q.status}」的報價不可修改，請改為作廢後重新建立`)
  }

  const snapshot = await repo.getServiceSnapshot(input.service_code)
  if (!snapshot) throw new CareInputError('找不到這個服務方案，或方案已停用', 'service_code')

  const { total, lines } = buildQuoteTotals(input, snapshot.price)

  await repo.updateQuote(quoteId, {
    service_code: input.service_code,
    service_name_snapshot: snapshot.name,
    base_fee: snapshot.price,
    travel_estimate_amount: input.travel_estimate_amount,
    travel_estimate_basis: input.travel_estimate_basis,
    overtime_rule_snapshot: input.overtime_rule_snapshot,
    total_estimate: total,
    valid_until: input.valid_until,
  })
  await repo.deleteQuoteItems(quoteId)
  await repo.insertQuoteItems(lines.map(l => ({
    quote_id: quoteId,
    item_code: l.item_code,
    label_snapshot: l.label_snapshot,
    unit_price: l.unit_price,
    quantity: l.quantity,
    line_total: l.line_total,
  })))

  return { quoteId, total }
}

export async function sendCareQuote(quoteId: number, actor: ActorAdmin) {
  const q = await loadQuoteOrThrow(quoteId)
  moveQuote(q.status, 'sent')
  await repo.updateQuote(quoteId, { status: 'sent', sent_at: new Date().toISOString() })

  const c = await loadCaseOrThrow(q.care_case_id)
  if (c.status === 'needs_assessment') {
    await repo.updateCase(c.id, { status: 'awaiting_quote_confirmation' })
  }
  return { from: q.status, to: 'sent' as const, caseId: q.care_case_id }
}

/**
 * 家屬確認報價（本輪由客服代為在後台確認）。
 * 確認後案件才可以進入 awaiting_payment。
 */
export async function confirmCareQuote(
  quoteId: number, confirmedByLabel: string, actor: ActorAdmin,
) {
  const q = await loadQuoteOrThrow(quoteId)
  if (isQuoteFrozen(q.status)) {
    throw new CareRuleError(`狀態為「${q.status}」的報價不可再確認`)
  }
  moveQuote(q.status, 'confirmed')

  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  if (q.valid_until < today) {
    throw new CareRuleError('這份報價已超過有效期限，請重新報價')
  }

  await repo.updateQuote(quoteId, {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    confirmed_by_label: confirmedByLabel,
    confirmed_by_admin_id: actor.id,
  })

  const c = await loadCaseOrThrow(q.care_case_id)
  if (c.status === 'awaiting_quote_confirmation') {
    await repo.updateCase(c.id, { status: 'awaiting_payment' })
  }
  return { from: q.status, to: 'confirmed' as const, caseId: q.care_case_id }
}

export async function expireCareQuote(quoteId: number, actor: ActorAdmin) {
  const q = await loadQuoteOrThrow(quoteId)
  moveQuote(q.status, 'expired')
  await repo.updateQuote(quoteId, { status: 'expired', expired_at: new Date().toISOString() })
  return { from: q.status, to: 'expired' as const }
}

export async function cancelCareQuote(quoteId: number, reasonCode: string, actor: ActorAdmin) {
  const q = await loadQuoteOrThrow(quoteId)
  moveQuote(q.status, 'cancelled')
  await repo.updateQuote(quoteId, {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancel_reason_code: reasonCode,
  })

  // 報價作廢後，案件退回重新評估，避免卡在等待確認
  const c = await loadCaseOrThrow(q.care_case_id)
  if (c.status === 'awaiting_quote_confirmation') {
    await repo.updateCase(c.id, { status: 'needs_assessment' })
  }
  return { from: q.status, to: 'cancelled' as const }
}

// ── 6. 前台方案（唯讀）─────────────────────────────────────
/**
 * 前台「方案與費用」頁使用。
 * Server Component 透過 Service 取得資料，不直接呼叫 Repository，
 * 也不直接碰 Supabase。
 */
export async function getPublicCareServices() {
  return repo.listActiveCareServices()
}

// ── 7. 總覽 ─────────────────────────────────────────────────
export async function getCareOperationsOverview() {
  const [intakes, cases, quotes] = await Promise.all([
    repo.countIntakesByStatus(),
    repo.countCasesByStatus(),
    repo.countQuotesByStatus(),
  ])
  return {
    pending_review: intakes.submitted || 0,
    needs_more_information: intakes.needs_more_information || 0,
    in_review: intakes.in_review || 0,
    declined: intakes.declined || 0,
    quote_draft: quotes.draft || 0,
    awaiting_quote_confirmation: cases.awaiting_quote_confirmation || 0,
    awaiting_payment: cases.awaiting_payment || 0,
    ready_to_match: cases.ready_to_match || 0,
    cancelled: cases.cancelled || 0,
  }
}
