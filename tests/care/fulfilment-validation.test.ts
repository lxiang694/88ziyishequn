import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAppendEvent, parseInvalidateEvent, parseRecordDraft, parseReturnRecord,
  parseSummaryDraft, parseWithdrawSummary, parseIncident, parseResolveIncident,
  parseGrantAuthorization, parseManualLine, parseReviewLine, parseBatchPeriod,
  FULFILMENT_LIMITS,
} from '../../lib/care/fulfilment/validation.ts'
import { CareInputError } from '../../lib/care/fulfilment/domain.ts'

describe('服務事件輸入', () => {
  test('合法事件通過', () => {
    const o = parseAppendEvent({ event_type: 'staff_arrived', family_note: '已抵達一樓大廳' })
    assert.equal(o.event_type, 'staff_arrived')
    assert.equal(o.family_note, '已抵達一樓大廳')
  })
  test('陪診員不能自己指定時間、可見性或身分', () => {
    const o: Record<string, unknown> = parseAppendEvent({
      event_type: 'beneficiary_met',
      occurred_at: '2020-01-01T00:00:00Z',
      created_at: '2020-01-01T00:00:00Z',
      visibility: 'family',
      companion_id: 999,
      booking_id: 1,
    }) as unknown as Record<string, unknown>
    assert.equal(o.occurred_at, undefined)
    assert.equal(o.created_at, undefined)
    assert.equal(o.visibility, undefined)
    assert.equal(o.companion_id, undefined)
    assert.equal(o.booking_id, undefined)
  })
  test('未知事件類型被拒', () => {
    assert.throws(() => parseAppendEvent({ event_type: 'patient_diagnosed' }), CareInputError)
  })
  test('給家屬的說明超過字數被拒', () => {
    assert.throws(
      () => parseAppendEvent({ event_type: 'staff_arrived', family_note: 'x'.repeat(FULFILMENT_LIMITS.EVENT_NOTE + 1) }),
      CareInputError)
  })
  test('說明含醫療內容被拒', () => {
    assert.throws(
      () => parseAppendEvent({ event_type: 'process_transition', family_note: '醫師診斷為肺炎' }),
      CareInputError)
  })
  test('作廢必須給白名單原因', () => {
    assert.equal(parseInvalidateEvent({ reason_code: 'entered_by_mistake' }).reason_code, 'entered_by_mistake')
    assert.throws(() => parseInvalidateEvent({ reason_code: '手滑' }), CareInputError)
    assert.throws(() => parseInvalidateEvent({}), CareInputError)
  })
})

describe('服務紀錄輸入', () => {
  test('全部布林預設 false', () => {
    const o = parseRecordDraft({})
    assert.equal(o.met_completed, false)
    assert.equal(o.family_follow_up_needed, false)
    assert.equal(o.follow_up_reason_code, null)
    assert.equal(o.objective_summary, null)
  })
  test('需要家屬處理時必須給原因 code', () => {
    assert.throws(() => parseRecordDraft({ family_follow_up_needed: true }), CareInputError)
    const o = parseRecordDraft({ family_follow_up_needed: true, follow_up_reason_code: 'family_confirmation_needed' })
    assert.equal(o.follow_up_reason_code, 'family_confirmation_needed')
  })
  test('不需要家屬處理時，原因會被清成 null', () => {
    const o = parseRecordDraft({ family_follow_up_needed: false, follow_up_reason_code: 'family_confirmation_needed' })
    assert.equal(o.follow_up_reason_code, null)
  })
  test('client 不能夾帶 status / 審核者 / 時間', () => {
    const o: Record<string, unknown> = parseRecordDraft({
      status: 'reviewed', reviewed_by_admin_id: 1, submitted_at: '2020-01-01', revision: 9,
    }) as unknown as Record<string, unknown>
    assert.equal(o.status, undefined)
    assert.equal(o.reviewed_by_admin_id, undefined)
    assert.equal(o.submitted_at, undefined)
    assert.equal(o.revision, undefined)
  })
  test('客觀說明含醫療內容被拒', () => {
    assert.throws(() => parseRecordDraft({ objective_summary: '醫師開了處方三天份' }), CareInputError)
  })
  test('客觀說明超過字數被拒', () => {
    assert.throws(
      () => parseRecordDraft({ objective_summary: 'x'.repeat(FULFILMENT_LIMITS.RECORD_SUMMARY + 1) }),
      CareInputError)
  })
  test('退回必須給白名單原因', () => {
    assert.equal(parseReturnRecord({ reason_code: 'incomplete_process_steps' }).reason_code, 'incomplete_process_steps')
    assert.throws(() => parseReturnRecord({ reason_code: 'nope' }), CareInputError)
  })
})

describe('家屬小結輸入', () => {
  const ok = {
    service_window_text: '09:10 至 12:40',
    completed_steps_text: '已完成報到、抽血、看診與領藥',
    family_actions_text: '請家屬向院方確認下次回診時段',
    next_arrangement_text: '院方提到約兩週後回診',
    handover_status_text: '已於一樓大廳與家屬會合完成交接',
  }
  test('合法小結通過', () => {
    const o = parseSummaryDraft(ok)
    assert.equal(o.service_window_text, ok.service_window_text)
    assert.equal(o.handover_status_text, ok.handover_status_text)
  })
  test('服務時間與已完成流程為必填', () => {
    assert.throws(() => parseSummaryDraft({ ...ok, service_window_text: '' }), CareInputError)
    assert.throws(() => parseSummaryDraft({ ...ok, completed_steps_text: '  ' }), CareInputError)
  })
  test('選填欄位留空正規化為 null', () => {
    const o = parseSummaryDraft({ ...ok, family_actions_text: '', next_arrangement_text: '', handover_status_text: '' })
    assert.equal(o.family_actions_text, null)
    assert.equal(o.next_arrangement_text, null)
    assert.equal(o.handover_status_text, null)
  })
  test('小結不可寫入診斷或治療建議', () => {
    assert.throws(() => parseSummaryDraft({ ...ok, completed_steps_text: '醫師診斷為肺炎並開立處方' }), CareInputError)
    assert.throws(() => parseSummaryDraft({ ...ok, next_arrangement_text: '建議停藥兩週' }), CareInputError)
  })
  test('client 不能夾帶 status / version / 發布者', () => {
    const o: Record<string, unknown> = parseSummaryDraft({
      ...ok, status: 'published', version_number: 5, published_by_admin_id: 1,
    }) as unknown as Record<string, unknown>
    assert.equal(o.status, undefined)
    assert.equal(o.version_number, undefined)
    assert.equal(o.published_by_admin_id, undefined)
  })
  test('撤回必須給白名單原因', () => {
    assert.equal(parseWithdrawSummary({ reason_code: 'published_in_error' }).reason_code, 'published_in_error')
    assert.throws(() => parseWithdrawSummary({}), CareInputError)
  })
})

describe('異常事件輸入', () => {
  test('合法異常通過，優先級預設 low', () => {
    const o = parseIncident({ incident_type: 'family_contact_needed' })
    assert.equal(o.severity, 'low')
    assert.equal(o.description, null)
  })
  test('不允許的類型被拒', () => {
    assert.throws(() => parseIncident({ incident_type: 'medical_emergency' }), CareInputError)
  })
  test('client 不能自行指定狀態或通知狀態', () => {
    const o: Record<string, unknown> = parseIncident({
      incident_type: 'family_contact_needed', status: 'closed', notification_status: 'sent_or_confirmed',
    }) as unknown as Record<string, unknown>
    assert.equal(o.status, undefined)
    assert.equal(o.notification_status, undefined)
  })
  test('狀況說明不可含醫療內容', () => {
    assert.throws(
      () => parseIncident({ incident_type: 'supervisor_attention_needed', description: '病人確診需要住院' }),
      CareInputError)
  })
  test('結案必須給白名單處理結果', () => {
    assert.equal(parseResolveIncident({ resolution_code: 'family_contacted' }).resolution_code, 'family_contacted')
    assert.throws(() => parseResolveIncident({ resolution_code: 'whatever' }), CareInputError)
  })
})

describe('家屬授權輸入', () => {
  const uid = '3f9a2c8e-14b7-460d-9e2f-5a1c8d3b7e60'
  test('合法 uuid 與範圍通過', () => {
    const o = parseGrantAuthorization({ user_id: uid, scope: 'view_service_summary' })
    assert.equal(o.user_id, uid)
  })
  test('非 uuid 被拒', () => {
    assert.throws(() => parseGrantAuthorization({ user_id: 'admin', scope: 'view_service_summary' }), CareInputError)
  })
  test('不允許的範圍被拒', () => {
    assert.throws(() => parseGrantAuthorization({ user_id: uid, scope: 'view_everything' }), CareInputError)
  })
})

describe('結算輸入', () => {
  test('合法人工調整通過', () => {
    const o = parseManualLine({
      line_type: 'manual_adjustment', amount: 300,
      basis_snapshot: '經督導同意的超時 30 分鐘', reason_code: 'overtime_agreed',
    })
    assert.equal(o.amount, 300)
  })
  test('負數與非整數金額被拒', () => {
    const base = { line_type: 'manual_adjustment', basis_snapshot: 'x', reason_code: 'overtime_agreed' }
    assert.throws(() => parseManualLine({ ...base, amount: -1 }), CareInputError)
    assert.throws(() => parseManualLine({ ...base, amount: 10.5 }), CareInputError)
  })
  test('計算依據為必填，且不可只留空白', () => {
    assert.throws(
      () => parseManualLine({ line_type: 'manual_adjustment', amount: 100, basis_snapshot: '   ', reason_code: 'overtime_agreed' }),
      CareInputError)
  })
  test('調整原因必須是白名單', () => {
    assert.throws(
      () => parseManualLine({ line_type: 'manual_adjustment', amount: 100, basis_snapshot: 'x', reason_code: '老闆說的' }),
      CareInputError)
  })
  test('client 不能夾帶 status 或審核者', () => {
    const o: Record<string, unknown> = parseManualLine({
      line_type: 'manual_adjustment', amount: 100, basis_snapshot: 'x', reason_code: 'overtime_agreed',
      status: 'published_to_staff', reviewed_by_admin_id: 1, employment_type_snapshot: 'fulltime',
    }) as unknown as Record<string, unknown>
    assert.equal(o.status, undefined)
    assert.equal(o.reviewed_by_admin_id, undefined)
    assert.equal(o.employment_type_snapshot, undefined)
  })
  test('審核決定只能是 approve 或 reject', () => {
    assert.equal(parseReviewLine({ decision: 'approve' }).decision, 'approve')
    assert.throws(() => parseReviewLine({ decision: 'publish' }), CareInputError)
  })
  test('批次期間迄日不可早於起日', () => {
    assert.throws(() => parseBatchPeriod({ period_start: '2026-03-31', period_end: '2026-03-01' }), CareInputError)
    const o = parseBatchPeriod({ period_start: '2026-03-01', period_end: '2026-03-31' })
    assert.equal(o.period_end, '2026-03-31')
  })
  test('日期格式錯誤被拒', () => {
    assert.throws(() => parseBatchPeriod({ period_start: '2026/03/01', period_end: '2026-03-31' }), CareInputError)
  })
})
