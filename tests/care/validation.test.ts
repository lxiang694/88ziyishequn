import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePublicIntake, parseQuoteDraft, parseDeclineIntake,
  parseRequestMoreInfo, parseCancelCase, parseConfirmQuote,
  buildQuoteTotals, VALIDATION_LIMITS,
} from '../../lib/care/validation.ts'
import { CareInputError } from '../../lib/care/domain.ts'

const validIntake = {
  service_scenario: 'visit_with_tests',
  mobility_support_level: 'wheelchair',
  transport_support_requested: true,
  hospital_name: '台大醫院',
  county: '台北市',
  scheduled_service_date: '2026-09-10',
  time_preference: 'morning',
  contact_name: '王小明',
  contact_phone: '0912345678',
  contact_line_id: 'ming123',
  contact_preference: 'line',
  relationship_to_beneficiary: '子女',
  limited_support_note: '長輩重聽，需要大聲說話',
}

describe('公開初評驗證', () => {
  test('合法輸入通過', () => {
    const out = parsePublicIntake(validIntake)
    assert.equal(out.service_scenario, 'visit_with_tests')
    assert.equal(out.contact_phone, '0912345678')
    assert.equal(out.transport_support_requested, true)
  })

  test('丟棄 client 夾帶的 status / id / source / ip', () => {
    const out: Record<string, unknown> = parsePublicIntake({
      ...validIntake,
      status: 'converted_to_case',
      id: 99,
      source: 'admin',
      submitter_ip_hash: 'deadbeef',
      reviewed_by_admin_id: 1,
    }) as unknown as Record<string, unknown>
    assert.equal(out.status, undefined)
    assert.equal(out.id, undefined)
    assert.equal(out.source, undefined)
    assert.equal(out.submitter_ip_hash, undefined)
    assert.equal(out.reviewed_by_admin_id, undefined)
  })

  test('不在白名單的情境被拒', () => {
    assert.throws(() => parsePublicIntake({ ...validIntake, service_scenario: 'anything' }), CareInputError)
  })

  test('手機格式錯誤被拒', () => {
    assert.throws(() => parsePublicIntake({ ...validIntake, contact_phone: '0212345678' }), CareInputError)
    assert.throws(() => parsePublicIntake({ ...validIntake, contact_phone: '091234567' }), CareInputError)
  })

  test('日期格式錯誤被拒', () => {
    assert.throws(() => parsePublicIntake({ ...validIntake, scheduled_service_date: '2026/09/10' }), CareInputError)
    assert.throws(() => parsePublicIntake({ ...validIntake, scheduled_service_date: '2026-13-45' }), CareInputError)
  })

  test('補充需求超過字數上限被拒', () => {
    assert.throws(
      () => parsePublicIntake({ ...validIntake, limited_support_note: 'x'.repeat(VALIDATION_LIMITS.NOTE_MAX + 1) }),
      CareInputError,
    )
  })

  test('選填欄位留空會正規化為 null', () => {
    const out = parsePublicIntake({ ...validIntake, contact_line_id: '', limited_support_note: '' })
    assert.equal(out.contact_line_id, null)
    assert.equal(out.limited_support_note, null)
  })

  test('缺必填欄位被拒', () => {
    const { contact_name, ...rest } = validIntake
    assert.throws(() => parsePublicIntake(rest), CareInputError)
  })

  test('非物件輸入被拒', () => {
    assert.throws(() => parsePublicIntake(null), CareInputError)
    assert.throws(() => parsePublicIntake('x'), CareInputError)
  })
})

const validDraft = {
  service_code: 'standard',
  travel_estimate_amount: 300,
  travel_estimate_basis: '以來回實際里程計費，每公里 15 元，停車費另依收據核實',
  overtime_rule_snapshot: '超過方案時數後，每 30 分鐘 300 元，服務前先告知',
  valid_until: '2026-09-30',
  items: [{ item_code: 'queue', label_snapshot: '代排隊掛號', unit_price: 200, quantity: 1 }],
}

describe('報價草稿驗證', () => {
  test('合法輸入通過', () => {
    const out = parseQuoteDraft(validDraft)
    assert.equal(out.service_code, 'standard')
    assert.equal(out.items.length, 1)
  })

  test('client 不能傳入總價、基本費或方案名稱快照', () => {
    const out: Record<string, unknown> = parseQuoteDraft({
      ...validDraft,
      total_estimate: 1,
      base_fee: 1,
      service_name_snapshot: '免費方案',
      status: 'confirmed',
      created_by_admin_id: 999,
      confirmed_by_admin_id: 999,
    }) as unknown as Record<string, unknown>
    assert.equal(out.total_estimate, undefined)
    assert.equal(out.base_fee, undefined)
    assert.equal(out.service_name_snapshot, undefined)
    assert.equal(out.status, undefined)
    assert.equal(out.created_by_admin_id, undefined)
    assert.equal(out.confirmed_by_admin_id, undefined)
  })

  test('交通計價說明與超時規則為必填，不可只寫「另計」而留空', () => {
    assert.throws(() => parseQuoteDraft({ ...validDraft, travel_estimate_basis: '' }), CareInputError)
    assert.throws(() => parseQuoteDraft({ ...validDraft, overtime_rule_snapshot: '   ' }), CareInputError)
  })

  test('負數金額被拒', () => {
    assert.throws(() => parseQuoteDraft({ ...validDraft, travel_estimate_amount: -1 }), CareInputError)
    assert.throws(
      () => parseQuoteDraft({ ...validDraft, items: [{ ...validDraft.items[0], unit_price: -5 }] }),
      CareInputError,
    )
  })

  test('非整數金額被拒', () => {
    assert.throws(() => parseQuoteDraft({ ...validDraft, travel_estimate_amount: 99.5 }), CareInputError)
  })

  test('數量為 0 被拒', () => {
    assert.throws(
      () => parseQuoteDraft({ ...validDraft, items: [{ ...validDraft.items[0], quantity: 0 }] }),
      CareInputError,
    )
  })

  test('明細數量上限', () => {
    const many = Array.from({ length: 21 }, () => validDraft.items[0])
    assert.throws(() => parseQuoteDraft({ ...validDraft, items: many }), CareInputError)
  })

  test('items 缺漏時視為空陣列', () => {
    const { items, ...rest } = validDraft
    assert.deepEqual(parseQuoteDraft(rest).items, [])
  })
})

describe('buildQuoteTotals 以伺服器方案價為準', () => {
  test('總價使用傳入的 baseFee，而非 client 提供的任何值', () => {
    const input = parseQuoteDraft({ ...validDraft, total_estimate: 1 })
    const { total, lines } = buildQuoteTotals(input, 1800)
    assert.equal(total, 1800 + 300 + 200)
    assert.equal(lines[0].line_total, 200)
  })

  test('換一個方案價，總價跟著變', () => {
    const input = parseQuoteDraft(validDraft)
    assert.equal(buildQuoteTotals(input, 3200).total, 3200 + 300 + 200)
  })
})

describe('後台操作參數驗證', () => {
  test('婉拒必須給白名單原因 code', () => {
    assert.equal(parseDeclineIntake({ reason_code: 'out_of_service_area' }).reason_code, 'out_of_service_area')
    assert.throws(() => parseDeclineIntake({ reason_code: '不想接' }), CareInputError)
    assert.throws(() => parseDeclineIntake({}), CareInputError)
  })

  test('婉拒說明有長度上限', () => {
    assert.throws(
      () => parseDeclineIntake({ reason_code: 'other', review_note: 'x'.repeat(VALIDATION_LIMITS.REVIEW_NOTE_MAX + 1) }),
      CareInputError,
    )
  })

  test('要求補件必須說明內容', () => {
    assert.throws(() => parseRequestMoreInfo({}), CareInputError)
    assert.equal(parseRequestMoreInfo({ review_note: '請補充預計檢查項目' }).review_note, '請補充預計檢查項目')
  })

  test('取消案件必須給白名單原因', () => {
    assert.equal(parseCancelCase({ reason_code: 'family_cancelled' }).reason_code, 'family_cancelled')
    assert.throws(() => parseCancelCase({ reason_code: 'whatever' }), CareInputError)
  })

  test('確認報價必須註明確認人', () => {
    assert.throws(() => parseConfirmQuote({}), CareInputError)
    assert.equal(parseConfirmQuote({ confirmed_by_label: '王小姐（女兒）' }).confirmed_by_label, '王小姐（女兒）')
  })
})
