/**
 * 陪診營運輸入驗證 —— 純函式，可單元測試。
 *
 * 專案沒有 zod（本輪不引入新套件），因此手寫驗證器。
 * 原則：白名單、限長、伺服器端重算金額；任何未列出的欄位一律丟棄，
 * 不讓 client 夾帶 status / actor / audit metadata / 總價。
 */
import {
  SERVICE_SCENARIOS, MOBILITY_LEVELS, TIME_PREFERENCES, CONTACT_PREFERENCES,
  DECLINE_REASON_CODES, CASE_CANCEL_REASON_CODES,
  CareInputError, computeQuoteTotal, computeLineTotal,
  type ServiceScenario, type MobilityLevel, type TimePreference,
  type ContactPreference, type QuoteLineInput,
} from './domain'

const NOTE_MAX = 200
const REVIEW_NOTE_MAX = 500
const TEXT_MAX = 120
const BASIS_MAX = 300

function str(v: unknown, field: string, opts: { max?: number; required?: boolean } = {}): string {
  const { max = TEXT_MAX, required = true } = opts
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

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new CareInputError(`${field} 必須是 true 或 false`, field)
  return v
}

function isoDate(v: unknown, field: string): string {
  const s = str(v, field, { max: 10 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CareInputError(`${field} 日期格式須為 YYYY-MM-DD`, field)
  const d = new Date(`${s}T00:00:00+08:00`)
  if (Number.isNaN(d.getTime())) throw new CareInputError(`${field} 不是有效日期`, field)
  return s
}

function nonNegativeInt(v: unknown, field: string, max = 1_000_000): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
    throw new CareInputError(`${field} 必須是整數`, field)
  }
  if (v < 0) throw new CareInputError(`${field} 不可為負數`, field)
  if (v > max) throw new CareInputError(`${field} 超過上限`, field)
  return v
}

function twMobile(v: unknown, field: string): string {
  const s = str(v, field, { max: 20 })
  if (!/^09\d{8}$/.test(s)) throw new CareInputError(`${field} 須為 09 開頭共 10 碼`, field)
  return s
}

// ── 公開初評送出 ────────────────────────────────────────────
export interface PublicIntakeInput {
  service_scenario: ServiceScenario
  mobility_support_level: MobilityLevel
  transport_support_requested: boolean
  hospital_name: string
  county: string
  scheduled_service_date: string
  time_preference: TimePreference
  contact_name: string
  contact_phone: string
  contact_line_id: string | null
  contact_preference: ContactPreference
  relationship_to_beneficiary: string
  limited_support_note: string | null
}

/**
 * 只取白名單欄位。client 就算多送 status / id / source / ip 也會被丟棄。
 */
export function parsePublicIntake(raw: unknown): PublicIntakeInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>

  const lineId = str(b.contact_line_id, 'LINE ID', { max: 60, required: false })
  const note = str(b.limited_support_note, '補充需求', { max: NOTE_MAX, required: false })

  return {
    service_scenario: oneOf(b.service_scenario, SERVICE_SCENARIOS, '就醫情境'),
    mobility_support_level: oneOf(b.mobility_support_level, MOBILITY_LEVELS, '行動協助'),
    transport_support_requested: bool(b.transport_support_requested, '交通協助'),
    hospital_name: str(b.hospital_name, '醫院名稱', { max: 80 }),
    county: str(b.county, '縣市', { max: 20 }),
    scheduled_service_date: isoDate(b.scheduled_service_date, '就醫日期'),
    time_preference: oneOf(b.time_preference ?? 'unspecified', TIME_PREFERENCES, '時段'),
    contact_name: str(b.contact_name, '聯絡人姓名', { max: 40 }),
    contact_phone: twMobile(b.contact_phone, '手機號碼'),
    contact_line_id: lineId || null,
    contact_preference: oneOf(b.contact_preference ?? 'phone', CONTACT_PREFERENCES, '聯絡方式'),
    relationship_to_beneficiary: str(b.relationship_to_beneficiary, '與就診人關係', { max: 40 }),
    limited_support_note: note || null,
  }
}

// ── 後台初評操作 ────────────────────────────────────────────
export function parseDeclineIntake(raw: unknown): { reason_code: string; review_note: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  const note = str(b.review_note, '說明', { max: REVIEW_NOTE_MAX, required: false })
  return {
    reason_code: oneOf(b.reason_code, DECLINE_REASON_CODES, '婉拒原因'),
    review_note: note || null,
  }
}

export function parseRequestMoreInfo(raw: unknown): { review_note: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { review_note: str(b.review_note, '需要補充的內容', { max: REVIEW_NOTE_MAX }) }
}

export function parseCancelCase(raw: unknown): { reason_code: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { reason_code: oneOf(b.reason_code, CASE_CANCEL_REASON_CODES, '取消原因') }
}

// ── 報價草稿 ────────────────────────────────────────────────
export interface QuoteDraftInput {
  service_code: string
  travel_estimate_amount: number
  travel_estimate_basis: string
  overtime_rule_snapshot: string
  valid_until: string
  items: QuoteLineInput[]
}

/**
 * 注意這裡刻意**沒有** total_estimate、base_fee、service_name_snapshot、
 * status、actor 等欄位：
 *  - base_fee 與 service_name_snapshot 由伺服器從 care_services 取當下值快照
 *  - total_estimate 由 computeQuoteTotal() 重算
 *  - status / actor 由 Service 決定
 * client 傳這些欄位一律無效。
 */
export function parseQuoteDraft(raw: unknown): QuoteDraftInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>

  const rawItems = Array.isArray(b.items) ? b.items : []
  if (rawItems.length > 20) throw new CareInputError('加購項目過多', 'items')

  const items: QuoteLineInput[] = rawItems.map((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>
    const line: QuoteLineInput = {
      item_code: str(o.item_code, `第 ${i + 1} 項項目代碼`, { max: 40 }),
      label_snapshot: str(o.label_snapshot, `第 ${i + 1} 項名稱`, { max: 80 }),
      unit_price: nonNegativeInt(o.unit_price, `第 ${i + 1} 項單價`),
      quantity: nonNegativeInt(o.quantity, `第 ${i + 1} 項數量`, 50),
    }
    if (line.quantity < 1) throw new CareInputError(`第 ${i + 1} 項數量須大於 0`, 'items')
    return line
  })

  return {
    service_code: str(b.service_code, '服務方案', { max: 40 }),
    travel_estimate_amount: nonNegativeInt(b.travel_estimate_amount ?? 0, '交通預估金額'),
    // 規格要求：不可只寫「另計」，必須說明計價方式
    travel_estimate_basis: str(b.travel_estimate_basis, '交通計價說明', { max: BASIS_MAX }),
    overtime_rule_snapshot: str(b.overtime_rule_snapshot, '超時規則', { max: BASIS_MAX }),
    valid_until: isoDate(b.valid_until, '報價有效期限'),
    items,
  }
}

export function parseConfirmQuote(raw: unknown): { confirmed_by_label: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { confirmed_by_label: str(b.confirmed_by_label, '確認人', { max: 40 }) }
}

/** 供 Service 使用：把方案快照與明細組成可寫入的報價列 */
export function buildQuoteTotals(
  input: QuoteDraftInput, baseFee: number,
): { total: number; lines: (QuoteLineInput & { line_total: number })[] } {
  const lines = input.items.map(i => ({ ...i, line_total: computeLineTotal(i) }))
  const total = computeQuoteTotal({
    base_fee: baseFee,
    travel_estimate_amount: input.travel_estimate_amount,
    items: input.items,
  })
  return { total, lines }
}

export const VALIDATION_LIMITS = { NOTE_MAX, REVIEW_NOTE_MAX, TEXT_MAX, BASIS_MAX }
