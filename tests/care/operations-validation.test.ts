import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCreateNotification, parseNotificationPreference, parseSuppressOutbox,
  parseSubmitFeedback, parseCreateConcern, parseResolveConcern, parseAssignConcern,
  parseCompleteQualityReview, parseCreateFollowUp,
  parseCreatePolicyVersion, parseCreateLifecycleReview, parseMarkLifecycleReviewed,
  findPersonalData, assertNoPersonalData,
} from '../../lib/care/operations/validation.ts'
import { CareInputError } from '../../lib/care/operations/domain.ts'

describe('通知輸入：內容不由 client 決定', () => {
  test('只接受 type 與站內連結', () => {
    const out = parseCreateNotification({
      notification_type: 'family_summary_published', link_path: '/care/booking/9',
    })
    assert.deepEqual(Object.keys(out).sort(), ['link_path', 'notification_type'])
  })

  test('client 傳 title/body/recipient/status 一律被丟棄', () => {
    const out: any = parseCreateNotification({
      notification_type: 'family_action_needed',
      title: '王小明的心導管檢查結果',
      body: '血壓 180/110，醫師建議調整用藥',
      recipient_user_id: 'someone-else',
      status: 'read',
      created_at: '2020-01-01',
    })
    for (const k of ['title', 'body', 'recipient_user_id', 'status', 'created_at']) {
      assert.equal(k in out, false, `${k} 不該被接受`)
    }
  })

  test('不合法的類型會被擋', () => {
    assert.throws(() => parseCreateNotification({ notification_type: 'anything' }), CareInputError)
  })
})

describe('通知偏好：外部 opt-in 不開放', () => {
  test('只接受 category 與 in_app_enabled', () => {
    const out = parseNotificationPreference({ category: 'schedule', in_app_enabled: false })
    assert.deepEqual(Object.keys(out).sort(), ['category', 'in_app_enabled'])
  })

  test('external_channel_opt_in 被丟棄', () => {
    const out: any = parseNotificationPreference({
      category: 'schedule', in_app_enabled: true,
      external_channel_opt_in: true, external_channel_kind: 'line',
    })
    assert.equal('external_channel_opt_in' in out, false)
    assert.equal('external_channel_kind' in out, false)
  })

  test('in_app_enabled 必須是布林值', () => {
    assert.throws(() => parseNotificationPreference({ category: 'schedule', in_app_enabled: 'yes' }),
      CareInputError)
  })
})

describe('個資偵測', () => {
  test('抓得到手機、身分證與 Email', () => {
    assert.deepEqual(findPersonalData('我的電話是 0912345678'), ['手機號碼'])
    assert.deepEqual(findPersonalData('身分證 A123456789'), ['身分證字號'])
    assert.deepEqual(findPersonalData('寄到 a@b.com'), ['Email'])
  })

  test('一次回報所有命中，不是只回第一個', () => {
    const hits = findPersonalData('打 0912345678 或寄 a@b.com')
    assert.ok(hits.includes('手機號碼'))
    assert.ok(hits.includes('Email'))
  })

  test('正常文字通過', () => {
    assert.deepEqual(findPersonalData('陪診員很準時，流程說明得很清楚'), [])
    assert.doesNotThrow(() => assertNoPersonalData('流程很順利', '意見'))
  })

  test('錯誤訊息會說出是哪一種個資', () => {
    assert.throws(() => assertNoPersonalData('打給我 0912345678', '意見'), /手機號碼/)
  })
})

describe('回饋輸入', () => {
  test('三個分數都必填且限 1–5', () => {
    const ok = parseSubmitFeedback({
      score_reassurance: 5, score_communication: 4, score_process_support: 5, comment: '謝謝',
    })
    assert.equal(ok.score_reassurance, 5)
    assert.throws(() => parseSubmitFeedback({
      score_reassurance: 6, score_communication: 4, score_process_support: 5 }), CareInputError)
    assert.throws(() => parseSubmitFeedback({
      score_reassurance: 0, score_communication: 4, score_process_support: 5 }), CareInputError)
    assert.throws(() => parseSubmitFeedback({
      score_communication: 4, score_process_support: 5 }), CareInputError)
  })

  test('補充意見含個資會被擋下', () => {
    assert.throws(() => parseSubmitFeedback({
      score_reassurance: 5, score_communication: 5, score_process_support: 5,
      comment: '有事打 0987654321',
    }), CareInputError)
  })

  test('補充意見超過 300 字會被擋下', () => {
    assert.throws(() => parseSubmitFeedback({
      score_reassurance: 5, score_communication: 5, score_process_support: 5,
      comment: 'x'.repeat(301),
    }), CareInputError)
  })

  test('client 傳 status/booking_id/user_id 都被丟棄', () => {
    const out: any = parseSubmitFeedback({
      score_reassurance: 3, score_communication: 3, score_process_support: 3,
      status: 'closed', booking_id: 99, submitted_by_user_id: 'other',
    })
    for (const k of ['status', 'booking_id', 'submitted_by_user_id']) {
      assert.equal(k in out, false)
    }
  })
})

describe('意見案件輸入', () => {
  test('類別走白名單', () => {
    assert.equal(parseCreateConcern({ category: 'schedule', description: '時間有點趕' }).category, 'schedule')
    assert.throws(() => parseCreateConcern({ category: 'medical_error', description: 'x' }), CareInputError)
  })

  test('說明含個資會被擋下', () => {
    assert.throws(() => parseCreateConcern({
      category: 'communication', description: '請打 0912345678 給我' }), CareInputError)
  })

  test('說明超過 500 字會被擋下', () => {
    assert.throws(() => parseCreateConcern({
      category: 'communication', description: 'x'.repeat(501) }), CareInputError)
  })

  test('處理結果走白名單，內部備註也做個資檢查', () => {
    assert.equal(parseResolveConcern({ resolution_code: 'process_adjusted' }).resolution_code,
      'process_adjusted')
    assert.throws(() => parseResolveConcern({ resolution_code: 'fired_the_staff' }), CareInputError)
    assert.throws(() => parseResolveConcern({
      resolution_code: 'process_adjusted', internal_note: '家屬電話 0912345678' }), CareInputError)
  })

  test('指派負責人需要合法 id', () => {
    assert.equal(parseAssignConcern({ owner_admin_id: 3 }).owner_admin_id, 3)
    assert.throws(() => parseAssignConcern({ owner_admin_id: 0 }), CareInputError)
    assert.throws(() => parseAssignConcern({ owner_admin_id: 'me' }), CareInputError)
  })
})

describe('品質覆核輸入', () => {
  test('checklist 未填時是 null，不是 false', () => {
    const out = parseCompleteQualityReview({ chk_events_complete: true })
    assert.equal(out.chk_events_complete, true)
    assert.equal(out.chk_record_on_time, null)
  })

  test('內部備註含個資會被擋下', () => {
    assert.throws(() => parseCompleteQualityReview({ internal_note: '打 0912345678 確認' }), CareInputError)
  })

  test('給陪診員看的說明也做個資檢查（他看得到）', () => {
    assert.throws(() => parseCreateFollowUp({
      action_code: 'record_timeliness', staff_visible_note: '家屬 a@b.com 有反映' }), CareInputError)
  })

  test('改善項目走白名單', () => {
    assert.equal(parseCreateFollowUp({ action_code: 'handover_process' }).action_code, 'handover_process')
    assert.throws(() => parseCreateFollowUp({ action_code: 'salary_cut' }), CareInputError)
  })

  test('給陪診員的說明限 200 字', () => {
    assert.throws(() => parseCreateFollowUp({
      action_code: 'other_process', staff_visible_note: 'x'.repeat(201) }), CareInputError)
  })
})

describe('政策版本輸入', () => {
  test('種類走白名單，正文必填', () => {
    const out = parseCreatePolicyVersion({
      policy_kind: 'privacy_notice', version_label: 'v2', body_text: '（法務提供的正文）' })
    assert.equal(out.policy_kind, 'privacy_notice')
    assert.throws(() => parseCreatePolicyVersion({
      policy_kind: 'privacy_notice', version_label: 'v2', body_text: '' }), CareInputError)
    assert.throws(() => parseCreatePolicyVersion({
      policy_kind: 'made_up', version_label: 'v2', body_text: 'x' }), CareInputError)
  })

  test('client 不能自己設 status 為 published', () => {
    const out: any = parseCreatePolicyVersion({
      policy_kind: 'terms_of_service', version_label: 'v1', body_text: 'x', status: 'published' })
    assert.equal('status' in out, false)
  })
})

describe('資料生命週期輸入', () => {
  test('資源類型與原因走白名單', () => {
    const out = parseCreateLifecycleReview({
      resource_kind: 'feedback', reason_code: 'retention_period_review' })
    assert.equal(out.resource_kind, 'feedback')
    assert.throws(() => parseCreateLifecycleReview({
      resource_kind: 'everything', reason_code: 'retention_period_review' }), CareInputError)
  })

  test('標記時不能標回 pending', () => {
    assert.equal(parseMarkLifecycleReviewed({ status: 'reviewed' }).status, 'reviewed')
    assert.throws(() => parseMarkLifecycleReviewed({ status: 'pending' }), CareInputError)
  })

  test('沒有 delete 這個選項', () => {
    assert.throws(() => parseMarkLifecycleReviewed({ status: 'deleted' }), CareInputError)
    assert.throws(() => parseMarkLifecycleReviewed({ status: 'anonymized' }), CareInputError)
  })
})

describe('outbox 抑制原因', () => {
  test('走白名單', () => {
    assert.equal(parseSuppressOutbox({ reason_code: 'operations_decision' }).reason_code,
      'operations_decision')
    assert.throws(() => parseSuppressOutbox({ reason_code: 'sent_already' }), CareInputError)
  })
})
