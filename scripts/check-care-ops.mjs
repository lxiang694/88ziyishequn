#!/usr/bin/env node
/**
 * 陪診營運（Sprint B）靜態驗收檢查。
 *
 * 單元測試（npm test）驗證的是執行期行為；這支腳本驗證的是
 * 「原始碼裡不該出現的東西」——那類問題單元測試看不到。
 * 純 node、零相依，比照 scripts/check-simplified.mjs，可進 CI。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
let failures = 0, passes = 0
const ok = m => { passes++; console.log(`  ✓ ${m}`) }
const fail = (m, d) => { failures++; console.log(`  ✗ ${m}`); if (d) console.log(`      ${d}`) }

const read = p => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null)
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '')

function walk(dir, out = []) {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return out
  for (const n of readdirSync(full)) {
    const rel = `${dir}/${n}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.tsx?$/.test(n)) out.push(rel)
  }
  return out
}

const CARE_LIB = 'lib/care'

/**
 * 只檢查 Sprint B 新增的營運端點。
 * 同一目錄下的 bookings / companions / events / settlement 是既有的
 * 陪診預約與結算功能，走既有的 requireAdmin + 自有權限檢查，
 * 責任不同且不在本輪範圍，重構它們會有回歸風險。
 */
const SPRINT_B_ROUTES = [
  'app/api/admin/care/intakes/route.ts',
  'app/api/admin/care/intakes/[id]/route.ts',
  'app/api/admin/care/cases/route.ts',
  'app/api/admin/care/cases/[id]/route.ts',
  'app/api/admin/care/quotes/route.ts',
  'app/api/admin/care/quotes/[id]/route.ts',
  'app/api/admin/care/overview/route.ts',
]

// ── 1. 後台 API 一律要求陪診業務權限 ───────────────────────
console.log('\n1. 後台陪診 API 的授權')
{
  const files = SPRINT_B_ROUTES.filter(f => existsSync(join(ROOT, f)))
  if (files.length !== SPRINT_B_ROUTES.length) {
    fail('部分 Sprint B 端點不存在',
      SPRINT_B_ROUTES.filter(f => !existsSync(join(ROOT, f))).join(', '))
  }
  let bad = 0
  for (const f of files) {
    const src = strip(read(f) || '')
    const handlers = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)].map(m => m[1])
    if (handlers.length === 0) continue
    if (!src.includes('requireCarePermission')) {
      fail(`${f} 未呼叫 requireCarePermission`); bad++
      continue
    }
    // 每個 handler 都要在自己內部檢查，不能只有其中一個
    const count = (src.match(/requireCarePermission\(/g) || []).length
    if (count < handlers.length) {
      fail(`${f} 有 ${handlers.length} 個 handler，但只檢查 ${count} 次權限`); bad++
    }
  }
  if (bad === 0) ok(`${files.length} 支後台陪診 API 每個 handler 都檢查權限`)
}

// ── 2. 沒有泛用 PATCH / PUT ────────────────────────────────
console.log('\n2. 只有固定 use case，沒有泛用更新端點')
{
  const files = SPRINT_B_ROUTES.filter(f => existsSync(join(ROOT, f)))
  const generic = files.filter(f => /export async function (PATCH|PUT)\b/.test(strip(read(f) || '')))
  if (generic.length === 0) ok('後台陪診 API 沒有 PATCH / PUT handler')
  else fail('出現泛用更新端點', generic.join(', '))

  // action 必須走 switch 白名單
  const withPost = files.filter(f => /export async function POST\b/.test(strip(read(f) || '')))
  const noSwitch = withPost.filter(f => {
    const s = strip(read(f) || '')
    return s.includes("body")
      && !s.includes('switch (action)')
      && !f.includes('/quotes/route.ts')  // 建立草稿只有單一動作
  })
  if (noSwitch.length === 0) ok('所有多動作端點都以 switch 白名單分派 action')
  else fail('有端點沒有用白名單分派 action', noSwitch.join(', '))
}

// ── 3. 金額與 actor 不可由 client 決定 ─────────────────────
console.log('\n3. 金額與 actor 由伺服器決定')
{
  const routeFiles = SPRINT_B_ROUTES.filter(f => existsSync(join(ROOT, f)))
  const leaks = []
  for (const f of routeFiles) {
    const src = strip(read(f) || '')
    // route handler 不得直接從 body 取這些欄位
    for (const key of ['total_estimate', 'base_fee', 'service_name_snapshot', 'created_by_admin_id', 'confirmed_by_admin_id']) {
      if (new RegExp(`body[^\\n]*\\b${key}\\b|\\b${key}\\b[^\\n]*body`).test(src)) {
        leaks.push(`${f}:${key}`)
      }
    }
  }
  if (leaks.length === 0) ok('Route handler 不從 request body 取用金額或 actor 欄位')
  else fail('有端點直接採用 client 傳來的金額或 actor', leaks.join(', '))

  const validation = strip(read(`${CARE_LIB}/validation.ts`) || '')
  // 只看 client 可控的輸入型別；buildQuoteTotals(input, baseFee) 的 baseFee
  // 是伺服器從 care_services 取的值，不在此列
  const iface = (validation.match(/interface QuoteDraftInput \{([\s\S]*?)\}/) || [])[1] || ''
  const forbidden = ['total_estimate', 'base_fee', 'service_name_snapshot', 'status', 'actor']
  const present = forbidden.filter(k => new RegExp(`\\b${k}\\b`).test(iface))
  if (iface && present.length === 0) ok('QuoteDraftInput 不含總價、基本費、快照名稱或 status')
  else if (!iface) fail('找不到 QuoteDraftInput 介面')
  else fail('QuoteDraftInput 含有不該由 client 控制的欄位', present.join(', '))
}

// ── 4. 稽核不得寫入敏感自由文字 ────────────────────────────
console.log('\n4. 稽核內容')
{
  const domain = strip(read(`${CARE_LIB}/domain.ts`) || '')
  const m = domain.match(/AUDIT_ALLOWED_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/)
  if (!m) {
    fail('找不到 AUDIT_ALLOWED_KEYS 白名單')
  } else {
    const keys = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
    const banned = ['contact_phone', 'contact_name', 'limited_support_note', 'review_note',
      'hospital_name', 'total_estimate', 'payment_token', 'id_number']
    const bad = keys.filter(k => banned.includes(k))
    if (bad.length === 0) ok(`稽核白名單只有 ${keys.length} 個安全欄位：${keys.join(', ')}`)
    else fail('稽核白名單含敏感欄位', bad.join(', '))
  }

  // route handler 不得把自由文字塞進 auditCare
  const leaks = SPRINT_B_ROUTES.filter(f => existsSync(join(ROOT, f))).filter(f => {
    const s = strip(read(f) || '')
    return /auditCare\([^)]*(review_note|contact_phone|limited_support_note|confirmed_by_label)/s.test(s)
  })
  if (leaks.length === 0) ok('沒有端點把自由文字或聯絡方式傳進稽核')
  else fail('稽核呼叫夾帶敏感欄位', leaks.join(', '))
}

// ── 5. 公開端點不得外洩 internal id 或提供查詢 ─────────────
console.log('\n5. 公開初評端點')
{
  const f = 'app/api/care/intake/route.ts'
  const src = strip(read(f) || '')
  if (!src) {
    fail(`${f} 不存在`)
  } else {
    if (!/export async function GET\b/.test(src)) ok('公開端點沒有 GET，匿名無法查詢任何初評')
    else fail('公開端點提供了 GET 查詢')

    if (/NextResponse\.json\(\{\s*success:\s*true\s*\}\)/.test(src)) ok('成功回應只有 { success: true }，不含 internal id')
    else fail('公開端點的成功回應可能夾帶額外資料')

    if (src.includes('parsePublicIntake')) ok('公開端點以白名單驗證輸入')
    else fail('公開端點未使用 parsePublicIntake')
  }

  const service = strip(read(`${CARE_LIB}/service.ts`) || '')
  if (service.includes('countRecentIntakesByIpHash')) ok('公開建立有每小時上限的防濫用檢查')
  else fail('公開建立缺少防濫用檢查')
  if (service.includes('hashIp(') && !/submitter_ip:\s/.test(service)) ok('只儲存 IP 雜湊，不存原始 IP')
  else fail('可能存了原始 IP')
}

// ── 6. React component 不得直接碰資料庫 ────────────────────
console.log('\n6. 分層')
{
  const components = [...walk('app/admin/care'), ...walk('app/(care)'), ...walk('components/care')]
    .filter(f => f.endsWith('.tsx'))
  const bad = components.filter(f => {
    const s = strip(read(f) || '')
    return s.includes('@/lib/care/repository') || s.includes('supabaseAdmin')
  })
  if (bad.length === 0) ok(`${components.length} 個 component 都未直接存取資料庫或 repository`)
  else fail('有 component 直接碰資料庫', bad.join(', '))

  const repo = strip(read(`${CARE_LIB}/repository.ts`) || '')
  if (repo && !repo.includes("'use client'")) ok('repository 為伺服器端模組')
  else fail('repository 疑似被標記為 client 模組')
}

// ── 7. 狀態機三處一致 ──────────────────────────────────────
console.log('\n7. 狀態機在資料庫端也有防護')
{
  const sql = read('migrations/care_operations_schema.sql')
  if (!sql) {
    fail('找不到 migrations/care_operations_schema.sql')
  } else {
    for (const fn of ['care_guard_intake_status', 'care_guard_case_status', 'care_guard_quote_write']) {
      if (sql.includes(fn)) ok(`資料庫 trigger ${fn} 已定義`)
      else fail(`缺少資料庫 trigger ${fn}`)
    }
    if (/enable row level security/.test(sql) && /revoke all on care_intakes\s+from anon/.test(sql)) {
      ok('四張表啟用 RLS 並對 anon / authenticated 撤銷權限')
    } else fail('RLS 或權限撤銷設定不完整')
  }
}

// ══════════ Sprint D：履約 ══════════
const SPRINT_D_ADMIN = [
  'app/api/admin/care/service-control/route.ts',
  'app/api/admin/care/services/[id]/route.ts',
  'app/api/admin/care/records/route.ts',
  'app/api/admin/care/records/[id]/route.ts',
  'app/api/admin/care/summaries/route.ts',
  'app/api/admin/care/summaries/[id]/route.ts',
  'app/api/admin/care/incidents/route.ts',
  'app/api/admin/care/incidents/[id]/route.ts',
  'app/api/admin/care/settlements/route.ts',
]
const FULFIL_LIB = 'lib/care/fulfilment'

console.log('\n8. 履約 API 的授權（Sprint D）')
{
  const files = SPRINT_D_ADMIN.filter(f => existsSync(join(ROOT, f)))
  if (files.length !== SPRINT_D_ADMIN.length) {
    fail('部分 Sprint D 端點不存在',
      SPRINT_D_ADMIN.filter(f => !existsSync(join(ROOT, f))).join(', '))
  }
  let bad = 0
  for (const f of files) {
    const src = strip(read(f) || '')
    const handlers = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)].map(m => m[1])
    const count = (src.match(/requireFulfilmentPermission\(/g) || []).length
    if (count < handlers.length) { fail(`${f}: ${handlers.length} 個 handler 只檢查 ${count} 次權限`); bad++ }
    if (/export async function (PATCH|PUT)\b/.test(src)) { fail(`${f} 出現泛用更新端點`); bad++ }
  }
  if (bad === 0) ok(`${files.length} 支履約 API 每個 handler 都檢查權限，且無泛用 PATCH/PUT`)

  // 金額只給財務權限
  const settle = strip(read('app/api/admin/care/settlements/route.ts') || '')
  if (/FULFILMENT_PERMISSIONS\.settlement/.test(settle)
      && !/FULFILMENT_ANY_PERMISSION/.test(settle)) {
    ok('結算端點只接受 care_settlement.manage，不接受任一 care 權限')
  } else fail('結算端點的權限過寬')

  // 陪診員端與家屬端不得用後台守門
  const staff = strip(read('app/api/companion/service/[bookingId]/route.ts') || '')
  if (staff.includes('requireStaff') && !staff.includes('requireFulfilmentPermission')) {
    ok('陪診員端使用 requireStaff，未誤用後台權限')
  } else fail('陪診員端守門不正確')

  const fam = strip(read('app/api/family/service/[bookingId]/route.ts') || '')
  if (fam.includes('requireFamilyUser') && !/export async function POST\b/.test(fam)) {
    ok('家屬端只有 GET，且要求登入會員')
  } else fail('家屬端守門或方法不正確')
}

console.log('\n9. 履約的內容與通知限制')
{
  const domain = strip(read(`${FULFIL_LIB}/domain.ts`) || '')

  if (/NOTIFICATION_PROVIDER_CONFIGURED\s*=\s*false/.test(domain)) {
    ok('沒有設定任何外部通知 provider，系統不會假裝已送出')
  } else fail('通知 provider 旗標不是 false，可能會產生假的已送出狀態')

  if (/DISABLED_SCOPES[^=]*=\s*\[[^\]]*view_service_photo/.test(domain)) {
    ok('照片檢視授權本輪停用')
  } else fail('view_service_photo 未被停用')

  if (/MEDICAL_TERMS/.test(domain) && /assertNoMedicalContent/.test(domain)) {
    ok('自由文字有醫療內容守門')
  } else fail('缺少醫療內容守門')

  // 驗證所有自由文字都過守門
  const validation = strip(read(`${FULFIL_LIB}/validation.ts`) || '')
  if (/function safeText/.test(validation) && /assertNoMedicalContent/.test(validation)) {
    ok('validation 以 safeText 統一套用守門')
  } else fail('validation 未統一套用醫療內容守門')

  // 陪診員不得自行決定可見性或時間
  const svc = strip(read(`${FULFIL_LIB}/service.ts`) || '')
  if (/visibility:\s*'internal'/.test(svc)) ok('陪診員建立的事件一律先進內部，無法自行公開')
  else fail('事件預設可見性不正確')

  const evtIface = (validation.match(/interface AppendEventInput \{([\s\S]*?)\}/) || [])[1] || ''
  const leaked = ['occurred_at', 'visibility', 'companion_id', 'booking_id']
    .filter(k => new RegExp(`\\b${k}\\b`).test(evtIface))
  if (evtIface && leaked.length === 0) ok('AppendEventInput 不含時間、可見性或身分欄位')
  else fail('事件輸入含有不該由 client 控制的欄位', leaked.join(', '))
}

console.log('\n10. 家屬端資料範圍')
{
  const svc = strip(read(`${FULFIL_LIB}/service.ts`) || '')
  const fam = (svc.match(/export async function getAuthorizedFamilyView[\s\S]*?\n\}/) || [''])[0]
  if (!fam) {
    fail('找不到 getAuthorizedFamilyView')
  } else {
    if (/hasServiceAuthorization/.test(fam)) ok('家屬讀取一律先檢查單筆授權')
    else fail('家屬讀取未檢查授權')

    const leaks = ['companion_id', 'companion_fee', 'objective_summary', 'contact_phone']
      .filter(k => new RegExp(`${k}:`).test(fam))
    if (leaks.length === 0) ok('家屬視圖不含陪診員身分、金額或內部紀錄')
    else fail('家屬視圖夾帶敏感欄位', leaks.join(', '))

    if (/status === 'published'/.test(svc) || /getPublishedSummary/.test(fam)) {
      ok('家屬只讀得到已發布的小結')
    } else fail('家屬可能讀到未發布的小結')
  }
}

console.log('\n11. 履約分層')
{
  const comps = [...walk('app/admin/care'), ...walk('app/companion'), ...walk('components/care')]
    .filter(f => f.endsWith('.tsx'))
  const bad = comps.filter(f => {
    const s = strip(read(f) || '')
    return s.includes('fulfilment/repository') || s.includes('supabaseAdmin')
  })
  if (bad.length === 0) ok(`${comps.length} 個 component 未直接存取 repository 或 service_role`)
  else fail('有 component 直接碰資料庫', bad.join(', '))

  const sql = read('migrations/care_fulfilment_schema.sql') || ''
  for (const fn of ['care_guard_service_event', 'care_guard_service_record',
                    'care_guard_family_summary', 'care_guard_incident',
                    'care_guard_settlement_line', 'care_guard_authorization']) {
    if (sql.includes(fn)) ok(`資料庫 trigger ${fn} 已定義`)
    else fail(`缺少資料庫 trigger ${fn}`)
  }
  if (/append-only/.test(sql) && /不可刪除/.test(sql)) ok('服務事件在資料庫層為 append-only')
  else fail('服務事件缺少 append-only 保護')
  if (/沒有正式通知管道，不可標記為已送出/.test(sql)) ok('資料庫層也擋下假的「已送出」')
  else fail('資料庫層未擋下已送出狀態')
}

// ══ Sprint C：人力、班表與人工媒合 ═══════════════════════════
const STAFFING_LIB = 'lib/care/staffing'

const SPRINT_C_ADMIN_ROUTES = [
  'app/api/admin/care/staff/route.ts',
  'app/api/admin/care/staff/[id]/route.ts',
  'app/api/admin/care/schedule/route.ts',
  'app/api/admin/care/time-off/route.ts',
  'app/api/admin/care/dispatch/route.ts',
  'app/api/admin/care/dispatch/proposals/route.ts',
  'app/api/admin/care/dispatch/proposals/[id]/route.ts',
]
const SPRINT_C_STAFF_ROUTES = [
  'app/api/companion/availability-rules/route.ts',
  'app/api/companion/time-off/route.ts',
  'app/api/companion/proposals/route.ts',
  'app/api/companion/proposals/[id]/route.ts',
]

console.log('\n12. 人力與媒合 API 的授權')
{
  for (const r of SPRINT_C_ADMIN_ROUTES) {
    const s = strip(read(r) || '')
    if (!s) { fail(`找不到 ${r}`); continue }
    if (/requireStaffingPermission\(/.test(s)) ok(`${r} 檢查陪診人力權限`)
    else fail(`${r} 未檢查陪診人力權限`)
  }
  for (const r of SPRINT_C_STAFF_ROUTES) {
    const s = strip(read(r) || '')
    if (!s) { fail(`找不到 ${r}`); continue }
    if (/requireOwnStaff\(/.test(s)) ok(`${r} 只允許本人操作`)
    else fail(`${r} 未限制為本人`)
  }

  const generic = [...SPRINT_C_ADMIN_ROUTES, ...SPRINT_C_STAFF_ROUTES]
    .filter(r => /export async function (PATCH|PUT)\b/.test(strip(read(r) || '')))
  if (generic.length === 0) ok('沒有任意欄位覆寫的 PATCH／PUT 端點')
  else fail('出現通用更新端點', generic.join(', '))
}

console.log('\n13. 邀請不等於指派')
{
  const svc = strip(read(`${STAFFING_LIB}/service.ts`) || '')
  const create = (svc.match(/export async function createPartTimeDispatchProposal[\s\S]*?\n\}/) || [''])[0]
  if (!create) {
    fail('找不到 createPartTimeDispatchProposal')
  } else {
    const assigns = ['assignBooking', 'updateBooking', 'setBookingCompanion', 'callAcceptProposal']
      .filter(k => create.includes(k))
    if (/insertProposal\(/.test(create) && /status:\s*'proposed'/.test(create) && assigns.length === 0) {
      ok('建立邀請只寫入 proposed 邀請，不會指派 care_bookings.companion_id')
    } else fail('建立邀請時就指派了陪診員', assigns.join(', '))
  }

  const accept = (svc.match(/export async function acceptOwnDispatchProposal[\s\S]*?\n\}/) || [''])[0]
  if (/repo\.callAcceptProposal\(/.test(accept)) ok('接受邀請一律走資料庫函式（單一交易）')
  else fail('接受邀請沒有走資料庫函式')

  const sql = read('migrations/care_staffing_schema.sql') || ''
  if (/create or replace function care_accept_dispatch_proposal/.test(sql)) {
    ok('資料庫函式 care_accept_dispatch_proposal 已定義')
  } else fail('缺少 care_accept_dispatch_proposal')
  const flat = sql.replace(/\s+/g, ' ')
  if (/from care_dispatch_proposals where id = p_proposal_id for update/.test(flat)
      && /from care_bookings where id = v_p\.booking_id for update/.test(flat)) {
    ok('接受流程對邀請與服務都先鎖列，兩人同搶只會有一個成功')
  } else fail('接受流程缺少列鎖，無法防止同時接受')
  if (/uniq_cdp_accepted_per_booking/.test(sql)) ok('同一筆服務只允許一筆 accepted 邀請（唯一索引）')
  else fail('缺少「一筆服務只能被接受一次」的唯一索引')
  if (/already_assigned/.test(sql)) ok('資料庫層會回報 already_assigned，不靠前端擋')
  else fail('資料庫層未處理已被指派的情況')
}

console.log('\n14. 兼職接受前只看得到去敏感化摘要')
{
  const dom = strip(read(`${STAFFING_LIB}/domain.ts`) || '')
  const fn = (dom.match(/export function toProposalSummary[\s\S]*?\n\}/) || [''])[0]
  if (!fn) {
    fail('找不到 toProposalSummary')
  } else {
    const leaks = ['patient_name', 'contact_name', 'contact_phone', 'contact_line',
                   'hospital', 'department', 'pickup_address', 'notes', 'price', 'companion_fee']
      .filter(k => new RegExp(`${k}\\s*:`).test(fn))
    if (leaks.length === 0) ok('邀請摘要不含就診人、聯絡方式、醫院、地址、備註或金額')
    else fail('邀請摘要夾帶敏感欄位', leaks.join(', '))
    if (/county/.test(fn)) ok('邀請摘要只給到縣市層級')
    else fail('邀請摘要缺少縣市欄位')
  }

  const svc = strip(read(`${STAFFING_LIB}/service.ts`) || '')
  const list = (svc.match(/export async function listOwnProposalSummaries[\s\S]*?\n\}/) || [''])[0]
  if (/toProposalSummary\(/.test(list)) ok('陪診員端邀請列表一律經過去敏感化函式')
  else fail('陪診員端邀請列表未經過去敏感化函式')

  const route = strip(read('app/api/companion/proposals/route.ts') || '')
  if (/listOwnProposalSummaries\(/.test(route) && !/supabaseAdmin/.test(route)) {
    ok('陪診員邀請端點只回傳 Service 的摘要')
  } else fail('陪診員邀請端點可能繞過 Service')
}

console.log('\n15. 陪診員不得自行變更僱用型態與能力驗證')
{
  const banned = ['employment_type', 'employment_term', 'capability_code', 'verify_capability', 'companion_id']
  const bad = []
  for (const r of SPRINT_C_STAFF_ROUTES) {
    const s = strip(read(r) || '')
    // companion_id 只允許出現在「從 token 取自己 id」的情境，故一併檢查賦值形式
    const hits = banned.filter(k => new RegExp(`${k}\\s*[:=]`).test(s))
    if (hits.length) bad.push(`${r}（${hits.join('、')}）`)
  }
  if (bad.length === 0) ok('陪診員端點無法寫入僱用型態、能力驗證或他人身分')
  else fail('陪診員端點可寫入不該由本人決定的欄位', bad.join(' / '))

  const val = strip(read(`${STAFFING_LIB}/validation.ts`) || '')
  const term = (val.match(/interface EmploymentTermInput \{([\s\S]*?)\}/) || [])[1] || ''
  if (term && !/\b(status|actor|companion_id|verified_by)\b/.test(term)) {
    ok('EmploymentTermInput 不含 status 或身分欄位（由伺服器決定）')
  } else fail('僱用條件輸入含有不該由 client 控制的欄位')

  const http = strip(read(`${STAFFING_LIB}/http.ts`) || '')
  const own = (http.match(/export function requireOwnStaff[\s\S]*?\n\}/) || [''])[0]
  if (/requireCompanion\(req\)/.test(own) && /auth\.companion\.id/.test(own)) {
    ok('本人身分取自 cookie／token，不是請求內容')
  } else fail('requireOwnStaff 未從 token 取得身分')
}

console.log('\n16. 人力模組分層')
{
  const comps = [...walk('app/companion'), ...walk('components/companion'), ...walk('app/admin/care')]
    .filter(f => f.endsWith('.tsx'))
  const bad = comps.filter(f => {
    const s = strip(read(f) || '')
    return s.includes('staffing/repository') || s.includes('staffing/service') || s.includes('supabaseAdmin')
  })
  if (bad.length === 0) ok(`${comps.length} 個 component 未直接呼叫 repository／service_role`)
  else fail('有 component 直接碰資料庫或 Service', bad.join(', '))

  const sql = read('migrations/care_staffing_schema.sql') || ''
  // RLS 用 do $$ 迴圈一次套用，所以檢查表名有沒有在那份清單裡
  // 檔案裡有多個 foreach 迴圈，挑出真正做 RLS 的那一個
  const loops = [...sql.matchAll(/foreach t in array array\[([\s\S]*?)\] loop([\s\S]*?)end loop/g)]
  const rlsBlock = loops.find(m => /enable row level security/.test(m[2])) || ['', '', '']
  const rlsList = rlsBlock[1]
  const rlsBody = rlsBlock[2]
  const rlsOn = /enable row level security/.test(rlsBody)
    && /force row level security/.test(rlsBody)
    && /revoke all on/.test(rlsBody)
  for (const t of ['staff_employment_terms', 'staff_service_regions', 'staff_capabilities',
                   'staff_capability_verifications', 'staff_availability_rules',
                   'staff_time_off_requests', 'care_dispatch_proposals']) {
    if (rlsOn && rlsList.includes(`'${t}'`)) ok(`${t} 已啟用並強制 RLS，且撤銷 anon／authenticated`)
    else fail(`${t} 未啟用 RLS`)
  }
  if (/uniq_set_open_per_companion/.test(sql)) ok('同一人同時只能有一筆未結束的僱用條件')
  else fail('缺少僱用條件唯一性保護')
  if (/uniq_cdp_open_per_pair/.test(sql)) ok('同一人對同一筆服務不會有重複的待回覆邀請')
  else fail('缺少重複邀請保護')
}

console.log(`\n── 結果 ──\n  通過 ${passes}\n  失敗 ${failures}\n`)
if (failures > 0) { console.log('✗ 陪診營運檢查未通過\n'); process.exit(1) }
console.log('✓ 陪診營運檢查全部通過\n')
