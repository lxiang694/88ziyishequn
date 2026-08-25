import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  INTAKE_TRANSITIONS, CASE_TRANSITIONS, QUOTE_TRANSITIONS,
  canTransition, assertTransition, isQuoteFrozen,
  computeQuoteTotal, computeLineTotal, buildAuditDetail,
  CareRuleError,
  type IntakeStatus, type CaseStatus, type QuoteStatus,
} from '../../lib/care/domain.ts'

describe('初評狀態機', () => {
  test('允許的轉換', () => {
    assert.ok(canTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'submitted', 'in_review'))
    assert.ok(canTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'in_review', 'converted_to_case'))
    assert.ok(canTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'needs_more_information', 'in_review'))
  })

  test('不允許跳過審查直接轉案件', () => {
    assert.equal(canTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'submitted', 'converted_to_case'), false)
  })

  test('終態不可再轉出', () => {
    assert.equal(canTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'declined', 'in_review'), false)
    assert.equal(canTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'converted_to_case', 'declined'), false)
  })

  test('assertTransition 對非法轉換丟 CareRuleError', () => {
    assert.throws(
      () => assertTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'declined', 'in_review', '初評'),
      CareRuleError,
    )
  })

  test('同狀態重複操作被擋下', () => {
    assert.throws(
      () => assertTransition<IntakeStatus>(INTAKE_TRANSITIONS, 'in_review', 'in_review', '初評'),
      CareRuleError,
    )
  })
})

describe('案件狀態機', () => {
  test('必須先確認報價才能等待付款', () => {
    assert.equal(canTransition<CaseStatus>(CASE_TRANSITIONS, 'needs_assessment', 'awaiting_payment'), false)
    assert.ok(canTransition<CaseStatus>(CASE_TRANSITIONS, 'awaiting_quote_confirmation', 'awaiting_payment'))
  })

  test('必須先等待付款才能準備媒合', () => {
    assert.equal(canTransition<CaseStatus>(CASE_TRANSITIONS, 'awaiting_quote_confirmation', 'ready_to_match'), false)
    assert.ok(canTransition<CaseStatus>(CASE_TRANSITIONS, 'awaiting_payment', 'ready_to_match'))
  })

  test('任何非終態都可取消，已取消不可復原', () => {
    for (const s of ['needs_assessment', 'awaiting_quote_confirmation', 'awaiting_payment', 'ready_to_match'] as CaseStatus[]) {
      assert.ok(canTransition<CaseStatus>(CASE_TRANSITIONS, s, 'cancelled'), `${s} 應可取消`)
    }
    assert.equal(CASE_TRANSITIONS.cancelled.length, 0)
  })
})

describe('報價狀態機', () => {
  test('草稿不可直接確認', () => {
    assert.equal(canTransition<QuoteStatus>(QUOTE_TRANSITIONS, 'draft', 'confirmed'), false)
    assert.ok(canTransition<QuoteStatus>(QUOTE_TRANSITIONS, 'draft', 'sent'))
    assert.ok(canTransition<QuoteStatus>(QUOTE_TRANSITIONS, 'sent', 'confirmed'))
  })

  test('已確認與已過期的報價被凍結', () => {
    assert.ok(isQuoteFrozen('confirmed'))
    assert.ok(isQuoteFrozen('expired'))
    assert.ok(isQuoteFrozen('cancelled'))
    assert.equal(isQuoteFrozen('draft'), false)
    assert.equal(isQuoteFrozen('sent'), false)
  })

  test('已過期的報價不可再被確認或送出', () => {
    assert.equal(canTransition<QuoteStatus>(QUOTE_TRANSITIONS, 'expired', 'confirmed'), false)
    assert.equal(canTransition<QuoteStatus>(QUOTE_TRANSITIONS, 'expired', 'sent'), false)
  })

  test('已確認的報價只能作廢，不能改回草稿', () => {
    assert.deepEqual(QUOTE_TRANSITIONS.confirmed, ['cancelled'])
  })
})

describe('報價金額由伺服器重算', () => {
  test('合計 = 基本 + 交通 + 明細', () => {
    const total = computeQuoteTotal({
      base_fee: 1800,
      travel_estimate_amount: 300,
      items: [
        { item_code: 'queue', label_snapshot: '代排隊', unit_price: 200, quantity: 1 },
        { item_code: 'report', label_snapshot: '書面整理', unit_price: 150, quantity: 2 },
      ],
    })
    assert.equal(total, 1800 + 300 + 200 + 300)
  })

  test('沒有明細時合計仍正確', () => {
    assert.equal(computeQuoteTotal({ base_fee: 1000, travel_estimate_amount: 0, items: [] }), 1000)
  })

  test('單項小計 = 單價 × 數量', () => {
    assert.equal(computeLineTotal({ item_code: 'x', label_snapshot: 'x', unit_price: 250, quantity: 3 }), 750)
  })
})

describe('稽核 detail 只保留安全欄位', () => {
  test('丟棄電話、備註、姓名、金額與 token', () => {
    const out = JSON.parse(buildAuditDetail({
      resource: 'care_quote',
      resource_id: 12,
      from_status: 'sent',
      to_status: 'confirmed',
      contact_phone: '0912345678',
      limited_support_note: '長輩重聽，需大聲說話',
      contact_name: '王先生',
      total_estimate: 2400,
      payment_token: 'tok_live_abc',
    }))
    assert.deepEqual(Object.keys(out).sort(), ['from_status', 'resource', 'resource_id', 'to_status'])
    assert.equal(out.contact_phone, undefined)
    assert.equal(out.limited_support_note, undefined)
    assert.equal(out.payment_token, undefined)
    assert.equal(out.total_estimate, undefined)
  })

  test('白名單欄位仍限長，避免夾帶自由文字', () => {
    const out = JSON.parse(buildAuditDetail({ resource: 'care_intake', reason_code: 'x'.repeat(200) }))
    assert.equal(out.reason_code.length, 60)
  })

  test('輸出可被 JSON 解析且不含 undefined', () => {
    const out = buildAuditDetail({ resource: 'care_case', resource_id: undefined, to_status: null })
    assert.equal(out, '{"resource":"care_case"}')
  })
})
