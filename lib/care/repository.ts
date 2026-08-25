/**
 * 陪診營運 Repository —— 唯一直接碰資料庫的一層。
 *
 * 架構現況說明（重要，不要誤讀）：
 * 本專案的後台沒有使用 Supabase Auth，管理員身分是自訂 JWT cookie（admin_token），
 * 因此不存在 request-scoped authenticated Supabase client；所有後台查詢都走
 * service_role。這代表 RLS 不是後台路徑的強制點，授權的實際強制點是
 * Route Handler 的 requirePermission() 加上本層以下的 Service 守衛。
 * RLS 仍然開啟並預設拒絕，用來擋住 anon key 與 authenticated 身分。
 * 詳見 SECURITY.md「已知限制」。
 *
 * React component 不得 import 這個檔案。
 */
import { supabaseAdmin } from '@/lib/supabase'
import type { CaseStatus, IntakeStatus, QuoteStatus } from './domain'

export interface CareIntakeRow {
  id: number
  service_scenario: string
  mobility_support_level: string
  transport_support_requested: boolean
  hospital_name: string
  county: string
  scheduled_service_date: string
  time_preference: string
  contact_name: string
  contact_phone: string
  contact_line_id: string | null
  contact_preference: string
  relationship_to_beneficiary: string
  limited_support_note: string | null
  status: IntakeStatus
  decline_reason_code: string | null
  review_note: string | null
  source: string
  reviewed_by_admin_id: number | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface CareCaseRow {
  id: number
  case_no: string
  intake_id: number
  status: CaseStatus
  owner_admin_id: number | null
  cancel_reason_code: string | null
  cancelled_at: string | null
  payment_marked_by: string | null
  payment_marked_at: string | null
  created_at: string
  updated_at: string
}

export interface CareQuoteRow {
  id: number
  care_case_id: number
  version: number
  status: QuoteStatus
  currency: string
  service_code: string
  service_name_snapshot: string
  base_fee: number
  travel_estimate_amount: number
  travel_estimate_basis: string
  overtime_rule_snapshot: string
  total_estimate: number
  valid_until: string
  sent_at: string | null
  confirmed_at: string | null
  confirmed_by_label: string | null
  expired_at: string | null
  cancelled_at: string | null
  cancel_reason_code: string | null
  created_at: string
  updated_at: string
}

export interface CareQuoteItemRow {
  id: number
  quote_id: number
  item_code: string
  label_snapshot: string
  unit_price: number
  quantity: number
  line_total: number
}

/** 資料表尚未建立時，讓上層顯示「請先執行 migration」而不是整頁 500 */
export class CareTableMissingError extends Error {
  readonly kind = 'care_table_missing'
  constructor() {
    super('陪診營運資料表尚未建立，請先執行 migrations/care_operations_schema.sql')
    this.name = 'CareTableMissingError'
  }
}

function raise(error: { code?: string; message: string } | null): void {
  if (!error) return
  if (error.code === '42P01') throw new CareTableMissingError()
  throw new Error(error.message)
}

// ── 初評 ────────────────────────────────────────────────────

/** 列表刻意不回傳 limited_support_note：清單頁不需要看到自由文字 */
const INTAKE_LIST_COLUMNS =
  'id, service_scenario, mobility_support_level, transport_support_requested, hospital_name, county, ' +
  'scheduled_service_date, time_preference, contact_name, status, decline_reason_code, created_at, updated_at'

export async function insertIntake(row: Record<string, unknown>): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('care_intakes').insert(row).select('id').single()
  raise(error as any)
  return (data as any).id as number
}

export async function countRecentIntakesByIpHash(ipHash: string, sinceIso: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('care_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('submitter_ip_hash', ipHash)
    .gte('created_at', sinceIso)
  raise(error as any)
  return count || 0
}

export async function listIntakes(status?: string): Promise<Partial<CareIntakeRow>[]> {
  let q = supabaseAdmin.from('care_intakes').select(INTAKE_LIST_COLUMNS)
    .order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as Partial<CareIntakeRow>[]
}

export async function getIntake(id: number): Promise<CareIntakeRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_intakes').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as CareIntakeRow) || null
}

export async function updateIntake(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_intakes').update(patch).eq('id', id)
  raise(error as any)
}

export async function countIntakesByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('care_intakes').select('status')
  raise(error as any)
  const out: Record<string, number> = {}
  for (const r of (data || []) as { status: string }[]) out[r.status] = (out[r.status] || 0) + 1
  return out
}

// ── 案件 ────────────────────────────────────────────────────
export async function insertCase(row: Record<string, unknown>): Promise<CareCaseRow> {
  const { data, error } = await supabaseAdmin
    .from('care_cases').insert(row).select('*').single()
  raise(error as any)
  return data as CareCaseRow
}

export async function listCases(status?: string): Promise<CareCaseRow[]> {
  let q = supabaseAdmin.from('care_cases').select('*')
    .order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as CareCaseRow[]
}

export async function getCase(id: number): Promise<CareCaseRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_cases').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as CareCaseRow) || null
}

export async function updateCase(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_cases').update(patch).eq('id', id)
  raise(error as any)
}

export async function countCasesByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('care_cases').select('status')
  raise(error as any)
  const out: Record<string, number> = {}
  for (const r of (data || []) as { status: string }[]) out[r.status] = (out[r.status] || 0) + 1
  return out
}

// ── 報價 ────────────────────────────────────────────────────
export async function insertQuote(row: Record<string, unknown>): Promise<CareQuoteRow> {
  const { data, error } = await supabaseAdmin
    .from('care_quote_estimates').insert(row).select('*').single()
  raise(error as any)
  return data as CareQuoteRow
}

export async function insertQuoteItems(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabaseAdmin.from('care_quote_items').insert(rows)
  raise(error as any)
}

export async function deleteQuoteItems(quoteId: number): Promise<void> {
  const { error } = await supabaseAdmin.from('care_quote_items').delete().eq('quote_id', quoteId)
  raise(error as any)
}

export async function listQuotes(status?: string): Promise<CareQuoteRow[]> {
  let q = supabaseAdmin.from('care_quote_estimates').select('*')
    .order('created_at', { ascending: false }).limit(200)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  raise(error as any)
  return (data || []) as CareQuoteRow[]
}

export async function listQuotesForCase(caseId: number): Promise<CareQuoteRow[]> {
  const { data, error } = await supabaseAdmin.from('care_quote_estimates')
    .select('*').eq('care_case_id', caseId).order('version', { ascending: false })
  raise(error as any)
  return (data || []) as CareQuoteRow[]
}

export async function getQuote(id: number): Promise<CareQuoteRow | null> {
  const { data, error } = await supabaseAdmin
    .from('care_quote_estimates').select('*').eq('id', id).maybeSingle()
  raise(error as any)
  return (data as CareQuoteRow) || null
}

export async function getQuoteItems(quoteId: number): Promise<CareQuoteItemRow[]> {
  const { data, error } = await supabaseAdmin
    .from('care_quote_items').select('*').eq('quote_id', quoteId).order('id')
  raise(error as any)
  return (data || []) as CareQuoteItemRow[]
}

export async function updateQuote(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('care_quote_estimates').update(patch).eq('id', id)
  raise(error as any)
}

export async function nextQuoteVersion(caseId: number): Promise<number> {
  const { data, error } = await supabaseAdmin.from('care_quote_estimates')
    .select('version').eq('care_case_id', caseId)
    .order('version', { ascending: false }).limit(1)
  raise(error as any)
  const rows = (data || []) as { version: number }[]
  return rows.length ? rows[0].version + 1 : 1
}

export async function countQuotesByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('care_quote_estimates').select('status')
  raise(error as any)
  const out: Record<string, number> = {}
  for (const r of (data || []) as { status: string }[]) out[r.status] = (out[r.status] || 0) + 1
  return out
}

/** 前台方案頁用：唯讀啟用中的方案，component 不直接碰資料庫 */
export async function listActiveCareServices(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabaseAdmin
    .from('care_services')
    .select('code, name, hours_label, price, summary, suitable, features')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    if ((error as any).code === '42P01') return []
    throw new Error(error.message)
  }
  return (data || []) as Record<string, unknown>[]
}

/** 報價的方案快照來源：唯讀既有 care_services，不修改它 */
export async function getServiceSnapshot(code: string): Promise<{ name: string; price: number } | null> {
  const { data, error } = await supabaseAdmin.from('care_services')
    .select('name, price').eq('code', code).eq('is_active', true).maybeSingle()
  if (error && (error as any).code !== '42P01') throw new Error(error.message)
  if (!data) return null
  return { name: (data as any).name, price: (data as any).price }
}
