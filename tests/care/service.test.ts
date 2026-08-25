import { test, describe, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { CareRuleError, CareInputError } from '../../lib/care/domain.ts'

/**
 * Service 層測試：以記憶體假 Repository 取代資料庫。
 * 驗證的是 use case 的流程規則（狀態守衛、伺服器端重算、
 * client 無法夾帶總價／actor），不需要真實 Supabase。
 */

interface Row { [k: string]: any }

const db = {
  intakes: new Map<number, Row>(),
  cases: new Map<number, Row>(),
  quotes: new Map<number, Row>(),
  items: [] as Row[],
  services: new Map<string, { name: string; price: number }>(),
  seq: 0,
}

function reset() {
  db.intakes.clear(); db.cases.clear(); db.quotes.clear()
  db.items = []; db.services.clear(); db.seq = 0
  db.services.set('standard', { name: '標準陪診（半日）', price: 1800 })
  db.services.set('full', { name: '安心全日', price: 3200 })
}
const nextId = () => ++db.seq

mock.module('../../lib/care/repository.ts', {
  namedExports: {
    CareTableMissingError: class extends Error {},
    insertIntake: async (row: Row) => { const id = nextId(); db.intakes.set(id, { id, ...row }); return id },
    countRecentIntakesByIpHash: async (h: string) =>
      [...db.intakes.values()].filter(r => r.submitter_ip_hash === h).length,
    getIntake: async (id: number) => db.intakes.get(id) || null,
    updateIntake: async (id: number, p: Row) => { Object.assign(db.intakes.get(id)!, p) },
    listIntakes: async () => [...db.intakes.values()],
    countIntakesByStatus: async () => ({}),
    insertCase: async (row: Row) => { const id = nextId(); const r = { id, ...row }; db.cases.set(id, r); return r },
    getCase: async (id: number) => db.cases.get(id) || null,
    updateCase: async (id: number, p: Row) => { Object.assign(db.cases.get(id)!, p) },
    listCases: async () => [...db.cases.values()],
    countCasesByStatus: async () => ({}),
    insertQuote: async (row: Row) => { const id = nextId(); const r = { id, ...row }; db.quotes.set(id, r); return r },
    getQuote: async (id: number) => db.quotes.get(id) || null,
    updateQuote: async (id: number, p: Row) => { Object.assign(db.quotes.get(id)!, p) },
    listQuotes: async () => [...db.quotes.values()],
    listQuotesForCase: async (cid: number) => [...db.quotes.values()].filter(q => q.care_case_id === cid),
    countQuotesByStatus: async () => ({}),
    insertQuoteItems: async (rows: Row[]) => { db.items.push(...rows) },
    deleteQuoteItems: async (qid: number) => { db.items = db.items.filter(i => i.quote_id !== qid) },
    getQuoteItems: async (qid: number) => db.items.filter(i => i.quote_id === qid),
    nextQuoteVersion: async (cid: number) => {
      const vs = [...db.quotes.values()].filter(q => q.care_case_id === cid).map(q => q.version)
      return vs.length ? Math.max(...vs) + 1 : 1
    },
    getServiceSnapshot: async (code: string) => db.services.get(code) || null,
  },
})

const svc = await import('../../lib/care/service.ts')
const { parsePublicIntake, parseQuoteDraft } = await import('../../lib/care/validation.ts')

const actor = { id: 7, name: '客服小美', account: 'meimei' }

const intakeInput = {
  service_scenario: 'visit_with_tests',
  mobility_support_level: 'wheelchair',
  transport_support_requested: true,
  hospital_name: '台大醫院',
  county: '台北市',
  scheduled_service_date: '2026-09-10',
  time_preference: 'morning',
  contact_name: '王小明',
  contact_phone: '0912345678',
  contact_line_id: null,
  contact_preference: 'phone',
  relationship_to_beneficiary: '子女',
  limited_support_note: null,
}

const draftInput = {
  service_code: 'standard',
  travel_estimate_amount: 300,
  travel_estimate_basis: '來回實際里程每公里 15 元，停車費核實計算',
  overtime_rule_snapshot: '超過方案時數後每 30 分鐘 300 元',
  valid_until: '2099-12-31',
  items: [{ item_code: 'queue', label_snapshot: '代排隊掛號', unit_price: 200, quantity: 1 }],
}

async function seedCase() {
  await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '1.2.3.4')
  const intakeId = [...db.intakes.keys()][0]
  await svc.startCareIntakeReview(intakeId, actor)
  const { caseId } = await svc.convertCareIntakeToCase(intakeId, actor)
  return { intakeId, caseId }
}

beforeEach(reset)

describe('公開初評建立', () => {
  test('不回傳任何 internal id', async () => {
    const r = await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '1.2.3.4')
    assert.deepEqual(Object.keys(r), ['accepted'])
    assert.equal((r as any).id, undefined)
  })

  test('狀態與來源由伺服器決定', async () => {
    await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '1.2.3.4')
    const row = [...db.intakes.values()][0]
    assert.equal(row.status, 'submitted')
    assert.equal(row.source, 'public_web')
  })

  test('只存 IP 雜湊，不存原始 IP', async () => {
    await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '1.2.3.4')
    const row = [...db.intakes.values()][0]
    assert.notEqual(row.submitter_ip_hash, '1.2.3.4')
    assert.match(row.submitter_ip_hash, /^[0-9a-f]{64}$/)
  })

  test('同一 IP 每小時上限擋下濫用', async () => {
    for (let i = 0; i < 5; i++) {
      await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '9.9.9.9')
    }
    await assert.rejects(
      () => svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '9.9.9.9'),
      CareRuleError,
    )
  })
})

describe('初評流程守衛', () => {
  test('未經審查不可直接轉案件', async () => {
    await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '1.1.1.1')
    const id = [...db.intakes.keys()][0]
    await assert.rejects(() => svc.convertCareIntakeToCase(id, actor), CareRuleError)
  })

  test('已婉拒的初評不可再啟動審查', async () => {
    await svc.createCareIntakeFromPublicRequest(parsePublicIntake(intakeInput) as any, '1.1.1.1')
    const id = [...db.intakes.keys()][0]
    await svc.declineCareIntake(id, 'out_of_service_area', null, actor)
    await assert.rejects(() => svc.startCareIntakeReview(id, actor), CareRuleError)
  })

  test('轉案件後初評與案件狀態一致', async () => {
    const { intakeId, caseId } = await seedCase()
    assert.equal(db.intakes.get(intakeId)!.status, 'converted_to_case')
    assert.equal(db.cases.get(caseId)!.status, 'needs_assessment')
  })

  test('同一筆初評不可重複轉案件', async () => {
    const { intakeId } = await seedCase()
    await assert.rejects(() => svc.convertCareIntakeToCase(intakeId, actor), CareRuleError)
  })
})

describe('報價：金額一律伺服器重算', () => {
  test('client 傳入的 total_estimate 被忽略', async () => {
    const { caseId } = await seedCase()
    const input = parseQuoteDraft({ ...draftInput, total_estimate: 1, base_fee: 1 })
    const r = await svc.createCareQuoteDraft(caseId, input, actor)
    assert.equal(r.total, 1800 + 300 + 200)
    assert.equal(db.quotes.get(r.quoteId)!.base_fee, 1800)
    assert.equal(db.quotes.get(r.quoteId)!.total_estimate, 2300)
  })

  test('方案名稱快照取自伺服器，不用 client 提供的值', async () => {
    const { caseId } = await seedCase()
    const input = parseQuoteDraft({ ...draftInput, service_name_snapshot: '免費方案' })
    const r = await svc.createCareQuoteDraft(caseId, input, actor)
    assert.equal(db.quotes.get(r.quoteId)!.service_name_snapshot, '標準陪診（半日）')
  })

  test('不存在的方案被拒', async () => {
    const { caseId } = await seedCase()
    const input = parseQuoteDraft({ ...draftInput, service_code: 'nope' })
    await assert.rejects(() => svc.createCareQuoteDraft(caseId, input, actor), CareInputError)
  })

  test('版本號逐次遞增', async () => {
    const { caseId } = await seedCase()
    const a = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    const b = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    assert.equal(a.version, 1)
    assert.equal(b.version, 2)
  })
})

describe('報價狀態守衛', () => {
  test('草稿不可直接確認', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await assert.rejects(() => svc.confirmCareQuote(q.quoteId, '王小姐', actor), CareRuleError)
  })

  test('已確認的報價不可再被修改', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    await svc.confirmCareQuote(q.quoteId, '王小姐', actor)
    await assert.rejects(
      () => svc.updateCareQuoteDraft(q.quoteId, parseQuoteDraft({ ...draftInput, service_code: 'full' }), actor),
      CareRuleError,
    )
    assert.equal(db.quotes.get(q.quoteId)!.total_estimate, 2300)
  })

  test('已過期的報價不可再被確認', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    await svc.expireCareQuote(q.quoteId, actor)
    await assert.rejects(() => svc.confirmCareQuote(q.quoteId, '王小姐', actor), CareRuleError)
  })

  test('超過有效期限的報價不可確認', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft({ ...draftInput, valid_until: '2020-01-01' }), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    await assert.rejects(() => svc.confirmCareQuote(q.quoteId, '王小姐', actor), CareRuleError)
  })
})

describe('案件流程與付款', () => {
  test('送出報價後案件進入等待家屬確認', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    assert.equal(db.cases.get(caseId)!.status, 'awaiting_quote_confirmation')
  })

  test('報價確認後才進入等待付款', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    await svc.confirmCareQuote(q.quoteId, '王小姐', actor)
    assert.equal(db.cases.get(caseId)!.status, 'awaiting_payment')
  })

  test('未確認報價前不可標記收款', async () => {
    const { caseId } = await seedCase()
    await assert.rejects(() => svc.markCarePaymentReceived(caseId, actor), CareRuleError)
  })

  test('標記收款後進入準備媒合，並留下操作者', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    await svc.confirmCareQuote(q.quoteId, '王小姐', actor)
    await svc.markCarePaymentReceived(caseId, actor)
    const c = db.cases.get(caseId)!
    assert.equal(c.status, 'ready_to_match')
    assert.equal(c.payment_marked_by, '客服小美')
  })

  test('報價作廢後案件退回重新評估', async () => {
    const { caseId } = await seedCase()
    const q = await svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor)
    await svc.sendCareQuote(q.quoteId, actor)
    await svc.cancelCareQuote(q.quoteId, 'quote_rejected', actor)
    assert.equal(db.cases.get(caseId)!.status, 'needs_assessment')
  })

  test('已取消的案件不可再建立報價', async () => {
    const { caseId } = await seedCase()
    await svc.cancelCareCase(caseId, 'family_cancelled', actor)
    await assert.rejects(
      () => svc.createCareQuoteDraft(caseId, parseQuoteDraft(draftInput), actor),
      CareRuleError,
    )
  })
})
