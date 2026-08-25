import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECORD_TRANSITIONS, SUMMARY_TRANSITIONS, INCIDENT_TRANSITIONS,
  LINE_TRANSITIONS, BATCH_TRANSITIONS, NOTIFICATION_TRANSITIONS,
  canTransition, isRecordStaffEditable, isSummaryVisibleToFamily,
  isLineVisibleToStaff, mayEverBeFamilyVisible,
  hasServiceAuthorization, assertScopeEnabled, assertNotificationTransition,
  assertPartTimeForSettlement, checkNoMedicalContent, assertNoMedicalContent,
  NOTIFICATION_PROVIDER_CONFIGURED, DISABLED_SCOPES,
  CareRuleError, CareInputError,
  type RecordStatus, type SummaryStatus, type IncidentStatus,
  type LineStatus, type BatchStatus,
} from '../../lib/care/fulfilment/domain.ts'

describe('服務紀錄狀態機', () => {
  test('陪診員只能在草稿與退回狀態編輯', () => {
    assert.ok(isRecordStaffEditable('draft'))
    assert.ok(isRecordStaffEditable('returned_for_revision'))
    assert.equal(isRecordStaffEditable('submitted'), false)
    assert.equal(isRecordStaffEditable('reviewed'), false)
  })
  test('草稿不能直接變成已核可', () => {
    assert.equal(canTransition<RecordStatus>(RECORD_TRANSITIONS, 'draft', 'reviewed'), false)
    assert.ok(canTransition<RecordStatus>(RECORD_TRANSITIONS, 'draft', 'submitted'))
    assert.ok(canTransition<RecordStatus>(RECORD_TRANSITIONS, 'submitted', 'reviewed'))
  })
  test('已核可只能作廢，不能退回重編', () => {
    assert.deepEqual(RECORD_TRANSITIONS.reviewed, ['superseded'])
    assert.equal(canTransition<RecordStatus>(RECORD_TRANSITIONS, 'reviewed', 'draft'), false)
  })
  test('退回後可以重新送審', () => {
    assert.ok(canTransition<RecordStatus>(RECORD_TRANSITIONS, 'returned_for_revision', 'submitted'))
  })
})

describe('家屬小結狀態機', () => {
  test('只有 published 對家屬可見', () => {
    assert.ok(isSummaryVisibleToFamily('published'))
    for (const s of ['draft', 'in_review', 'withdrawn', 'superseded'] as SummaryStatus[]) {
      assert.equal(isSummaryVisibleToFamily(s), false, `${s} 不該對家屬可見`)
    }
  })
  test('草稿不可直接發布', () => {
    assert.equal(canTransition<SummaryStatus>(SUMMARY_TRANSITIONS, 'draft', 'published'), false)
    assert.ok(canTransition<SummaryStatus>(SUMMARY_TRANSITIONS, 'in_review', 'published'))
  })
  test('已發布只能撤回或被新版本取代，不能改回草稿', () => {
    assert.equal(canTransition<SummaryStatus>(SUMMARY_TRANSITIONS, 'published', 'draft'), false)
    assert.ok(canTransition<SummaryStatus>(SUMMARY_TRANSITIONS, 'published', 'withdrawn'))
  })
  test('撤回後不能再直接發布', () => {
    assert.equal(canTransition<SummaryStatus>(SUMMARY_TRANSITIONS, 'withdrawn', 'published'), false)
  })
})

describe('事件可見性', () => {
  test('需督導處理的事件永遠不對家屬顯示', () => {
    assert.equal(mayEverBeFamilyVisible('requires_supervisor_attention'), false)
    assert.equal(mayEverBeFamilyVisible('service_handover_ready'), false)
  })
  test('流程節點事件可能對家屬顯示', () => {
    assert.ok(mayEverBeFamilyVisible('staff_arrived'))
    assert.ok(mayEverBeFamilyVisible('beneficiary_met'))
  })
})

describe('異常事件與通知', () => {
  test('open 不能直接關閉', () => {
    assert.equal(canTransition<IncidentStatus>(INCIDENT_TRANSITIONS, 'open', 'closed'), false)
    assert.ok(canTransition<IncidentStatus>(INCIDENT_TRANSITIONS, 'open', 'acknowledged'))
    assert.ok(canTransition<IncidentStatus>(INCIDENT_TRANSITIONS, 'resolved', 'closed'))
  })
  test('沒有正式通知管道，所以永遠不能標記為已送出', () => {
    assert.equal(NOTIFICATION_PROVIDER_CONFIGURED, false)
    assert.throws(() => assertNotificationTransition('prepared', 'sent_or_confirmed'), CareRuleError)
  })
  test('可以推進到 prepared', () => {
    assert.doesNotThrow(() => assertNotificationTransition('pending', 'prepared'))
  })
  test('不可跳過 pending 直接 prepared', () => {
    assert.throws(() => assertNotificationTransition('not_required', 'prepared'), CareRuleError)
  })
  test('狀態表本身仍保留 sent_or_confirmed，供未來接上 connector', () => {
    assert.ok(NOTIFICATION_TRANSITIONS.prepared.includes('sent_or_confirmed'))
  })
})

describe('家屬授權', () => {
  const rows = [
    { booking_id: 1, user_id: 'u-a', scope: 'view_service_summary', revoked_at: null },
    { booking_id: 1, user_id: 'u-b', scope: 'view_service_summary', revoked_at: '2026-01-01T00:00:00Z' },
    { booking_id: 2, user_id: 'u-a', scope: 'receive_service_notification', revoked_at: null },
  ]
  test('有有效授權才通過', () => {
    assert.ok(hasServiceAuthorization(rows, 1, 'u-a', 'view_service_summary'))
  })
  test('已撤回的授權不通過', () => {
    assert.equal(hasServiceAuthorization(rows, 1, 'u-b', 'view_service_summary'), false)
  })
  test('別筆訂單的授權不能跨用', () => {
    assert.equal(hasServiceAuthorization(rows, 2, 'u-a', 'view_service_summary'), false)
  })
  test('授權範圍不能跨用', () => {
    assert.equal(hasServiceAuthorization(rows, 2, 'u-a', 'view_service_summary'), false)
    assert.ok(hasServiceAuthorization(rows, 2, 'u-a', 'receive_service_notification'))
  })
  test('未登入一律拒絕', () => {
    assert.equal(hasServiceAuthorization(rows, 1, null, 'view_service_summary'), false)
    assert.equal(hasServiceAuthorization(rows, 1, undefined, 'view_service_summary'), false)
  })
  test('沒有任何授權列一律拒絕', () => {
    assert.equal(hasServiceAuthorization([], 1, 'u-a', 'view_service_summary'), false)
    assert.equal(hasServiceAuthorization(null, 1, 'u-a', 'view_service_summary'), false)
  })
  test('照片權限本輪停用：即使有授權列也拒絕', () => {
    const photo = [{ booking_id: 1, user_id: 'u-a', scope: 'view_service_photo', revoked_at: null }]
    assert.ok(DISABLED_SCOPES.includes('view_service_photo'))
    assert.equal(hasServiceAuthorization(photo, 1, 'u-a', 'view_service_photo'), false)
    assert.throws(() => assertScopeEnabled('view_service_photo'), CareRuleError)
    assert.doesNotThrow(() => assertScopeEnabled('view_service_summary'))
  })
})

describe('結算', () => {
  test('全職不產生報酬明細', () => {
    assert.throws(() => assertPartTimeForSettlement('fulltime'), CareRuleError)
    assert.doesNotThrow(() => assertPartTimeForSettlement('parttime'))
  })
  test('陪診員只看得到已發布的明細', () => {
    assert.ok(isLineVisibleToStaff('published_to_staff'))
    for (const s of ['pending_review', 'approved', 'rejected', 'batched'] as LineStatus[]) {
      assert.equal(isLineVisibleToStaff(s), false, `${s} 不該對陪診員可見`)
    }
  })
  test('未審核不能直接發布給陪診員', () => {
    assert.equal(canTransition<LineStatus>(LINE_TRANSITIONS, 'pending_review', 'published_to_staff'), false)
    assert.ok(canTransition<LineStatus>(LINE_TRANSITIONS, 'approved', 'published_to_staff'))
  })
  test('已發布的明細是終態', () => {
    assert.deepEqual(LINE_TRANSITIONS.published_to_staff, [])
  })
  test('批次必須先核准才能發布，發布後才能關閉', () => {
    assert.equal(canTransition<BatchStatus>(BATCH_TRANSITIONS, 'draft', 'published'), false)
    assert.ok(canTransition<BatchStatus>(BATCH_TRANSITIONS, 'approved', 'published'))
    assert.equal(canTransition<BatchStatus>(BATCH_TRANSITIONS, 'approved', 'closed'), false)
    assert.ok(canTransition<BatchStatus>(BATCH_TRANSITIONS, 'published', 'closed'))
  })
})

describe('醫療內容守門', () => {
  test('客觀流程描述通過', () => {
    assert.ok(checkNoMedicalContent('已陪同完成報到，於三樓檢查區等待，預計還需一小時').ok)
    assert.ok(checkNoMedicalContent(null).ok)
    assert.ok(checkNoMedicalContent('').ok)
  })
  test('擋下診斷、處方、劑量與判讀', () => {
    for (const s of ['醫師診斷為肺炎', '處方三天份', '每次劑量 500 毫克', '報告顯示異常', '醫囑要多休息']) {
      assert.equal(checkNoMedicalContent(s).ok, false, `應擋下：${s}`)
    }
  })
  test('擋下用藥調整建議', () => {
    assert.equal(checkNoMedicalContent('建議停藥觀察').ok, false)
    assert.equal(checkNoMedicalContent('醫師換藥了').ok, false)
  })
  test('assertNoMedicalContent 丟 CareInputError 且訊息含欄位與命中詞', () => {
    try {
      assertNoMedicalContent('確診流感', '客觀說明')
      assert.fail('應該要丟錯')
    } catch (e) {
      assert.ok(e instanceof CareInputError)
      assert.match((e as Error).message, /客觀說明/)
      assert.match((e as Error).message, /確診/)
    }
  })
  test('回報所有命中的詞，不是只回第一個', () => {
    const r = checkNoMedicalContent('診斷後開了處方')
    assert.equal(r.ok, false)
    assert.ok(r.hits.length >= 2)
  })
})
