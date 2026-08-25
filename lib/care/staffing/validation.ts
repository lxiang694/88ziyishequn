/**
 * Sprint C 輸入驗證 —— 純函式，可單元測試。
 * 原則同前：白名單、限長、actor 與 status 由伺服器決定。
 */
import {
  EMPLOYMENT_TYPES, CAPABILITY_CODES, TIME_OFF_TYPES, TIME_OFF_REASON_CODES,
  DECLINE_REASON_CODES, CareInputError,
  type EmploymentType, type CapabilityCode,
} from './domain'

const MAX = { NOTE: 200, REGION: 20 }
export const STAFFING_LIMITS = MAX

function text(v: unknown, field: string, max: number, required = true): string {
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

function isoDate(v: unknown, field: string, required = true): string {
  if (!required && (v === undefined || v === null || v === '')) return ''
  const s = text(v, field, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new CareInputError(`${field} 格式須為 YYYY-MM-DD`, field)
  return s
}

function hhmm(v: unknown, field: string): string {
  const s = text(v, field, 5)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new CareInputError(`${field} 格式須為 HH:MM`, field)
  return s
}

function posInt(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new CareInputError(`${field} 須為 ${min} 到 ${max} 之間的整數`, field)
  }
  return v
}

// ── 僱用條件 ────────────────────────────────────────────────
export interface EmploymentTermInput {
  employment_type: EmploymentType
  effective_from: string
  effective_to: string | null
  note: string | null
}

/** 刻意沒有 status／actor：由 Service 決定 */
export function parseEmploymentTerm(raw: unknown): EmploymentTermInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const from = isoDate(b.effective_from, '生效日')
  const to = isoDate(b.effective_to, '結束日', false)
  if (to && to < from) throw new CareInputError('結束日不可早於生效日', 'effective_to')
  return {
    employment_type: oneOf(b.employment_type, EMPLOYMENT_TYPES, '僱用型態'),
    effective_from: from,
    effective_to: to || null,
    note: text(b.note, '備註', MAX.NOTE, false) || null,
  }
}

// ── 服務區域 ────────────────────────────────────────────────
export function parseRegion(raw: unknown): { region: string } {
  const b = (raw ?? {}) as Record<string, unknown>
  return { region: text(b.region, '服務區域', MAX.REGION) }
}

// ── 能力驗證 ────────────────────────────────────────────────
export interface VerifyCapabilityInput {
  capability_code: CapabilityCode
  expires_at: string | null
  note: string | null
}

export function parseVerifyCapability(raw: unknown): VerifyCapabilityInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    capability_code: oneOf(b.capability_code, CAPABILITY_CODES, '能力項目'),
    expires_at: isoDate(b.expires_at, '有效期限', false) || null,
    note: text(b.note, '備註', MAX.NOTE, false) || null,
  }
}

// ── 可服務時段 ──────────────────────────────────────────────
export interface AvailabilityRuleInput {
  weekday: number
  start_time: string
  end_time: string
  region: string | null
}

export function parseAvailabilityRule(raw: unknown): AvailabilityRuleInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const start = hhmm(b.start_time, '開始時間')
  const end = hhmm(b.end_time, '結束時間')
  if (end <= start) throw new CareInputError('結束時間必須晚於開始時間', 'end_time')
  return {
    weekday: posInt(b.weekday, '星期', 0, 6),
    start_time: start,
    end_time: end,
    region: text(b.region, '服務區域', MAX.REGION, false) || null,
  }
}

// ── 請假 ────────────────────────────────────────────────────
export interface TimeOffInput {
  request_type: string
  start_date: string
  end_date: string
  reason_code: string
  note: string | null
}

export function parseTimeOff(raw: unknown): TimeOffInput {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  const start = isoDate(b.start_date, '開始日期')
  const end = isoDate(b.end_date, '結束日期')
  if (end < start) throw new CareInputError('結束日期不可早於開始日期', 'end_date')
  return {
    request_type: oneOf(b.request_type, TIME_OFF_TYPES, '申請類型'),
    start_date: start,
    end_date: end,
    reason_code: oneOf(b.reason_code, TIME_OFF_REASON_CODES, '原因'),
    note: text(b.note, '補充說明', MAX.NOTE, false) || null,
  }
}

export function parseReviewTimeOff(raw: unknown): { decision: 'approve' | 'reject'; review_note: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  return {
    decision: oneOf(b.decision, ['approve', 'reject'] as const, '審核決定'),
    review_note: text(b.review_note, '審核備註', MAX.NOTE, false) || null,
  }
}

// ── 邀請 ────────────────────────────────────────────────────
export function parseCreateProposal(raw: unknown): { companion_id: number; expires_in_hours: number } {
  if (!raw || typeof raw !== 'object') throw new CareInputError('請求內容格式錯誤')
  const b = raw as Record<string, unknown>
  return {
    companion_id: posInt(b.companion_id, '陪診員', 1, 1_000_000_000),
    // 回覆期限由後台選，但限制在合理範圍，避免無限期占用
    expires_in_hours: posInt(b.expires_in_hours ?? 24, '回覆期限（小時）', 1, 168),
  }
}

export function parseDeclineProposal(raw: unknown): { reason_code: string; note: string | null } {
  const b = (raw ?? {}) as Record<string, unknown>
  return {
    reason_code: oneOf(b.reason_code, DECLINE_REASON_CODES, '婉拒原因'),
    note: text(b.note, '補充說明', MAX.NOTE, false) || null,
  }
}
