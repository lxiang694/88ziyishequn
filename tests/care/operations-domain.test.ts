import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  toNotificationPayload, assertRecipientKindMatches, shouldCreateInApp,
  resolveOutboxStatus, assertOutboxNeverSent, EXTERNAL_NOTIFICATION_ENABLED,
  OUTBOX_STATUSES, NOTIFICATION_TEMPLATES, NOTIFICATION_TYPES,
  isFeedbackEligible, assertFeedbackEligible, averageOrSuppressed, MIN_INSIGHT_SAMPLE,
  toConcernPublicStatus, toFollowUpStaffView,
  policyAcceptanceImpliesNothing, LIFECYCLE_DELETION_ENABLED,
  buildReadinessChecks, summarizeReadiness,
  OPERATIONS_READ_PERMISSIONS, CLOSURE_PERMISSION_KEYS,
  CareInputError, CareRuleError,
} from '../../lib/care/operations/domain.ts'

describe('通知內容：模板是唯一來源', () => {
  test('每個通知類型都有模板', () => {
    for (const t of NOTIFICATION_TYPES) {
      assert.ok(NOTIFICATION_TEMPLATES[t], `${t} 缺少模板`)
    }
  })

  test('模板不含病況、姓名、電話等字樣', () => {
    const banned = ['診斷', '處方', '用藥', '劑量', '檢查結果', '病歷', '金額', '報酬']
    for (const t of NOTIFICATION_TYPES) {
      const text = NOTIFICATION_TEMPLATES[t].title + NOTIFICATION_TEMPLATES[t].body
      for (const b of banned) {
        assert.equal(text.includes(b), false, `${t} 的模板含有「${b}」`)
      }
    }
  })

  test('標題與內文都在長度上限內', () => {
    for (const t of NOTIFICATION_TYPES) {
      const p = toNotificationPayload(t)
      assert.ok(p.title.length <= 60)
      assert.ok(p.body.length <= 200)
    }
  })

  test('連結必須是站內路徑', () => {
    assert.equal(toNotificationPayload('family_summary_published', '/care/booking/1').link_path,
      '/care/booking/1')
    assert.throws(() => toNotificationPayload('family_summary_published', 'https://evil.example'),
      CareInputError)
    assert.throws(() => toNotificationPayload('family_summary_published', '//evil.example'),
      CareInputError)
  })

  test('連結不可帶參數（會進到伺服器 log 與 analytics）', () => {
    assert.throws(() => toNotificationPayload('family_summary_published', '/care/booking/1?token=abc'),
      CareInputError)
    assert.throws(() => toNotificationPayload('family_summary_published', '/care/booking/1#x'),
      CareInputError)
  })

  test('不支援的類型會被擋下', () => {
    assert.throws(() => toNotificationPayload('anything' as any), CareInputError)
  })
})

describe('通知：收件人身分與類型必須相符', () => {
  test('家屬類型不能寄給陪診員', () => {
    assert.throws(() => assertRecipientKindMatches('family_summary_published', 'staff'), CareRuleError)
  })
  test('陪診員類型不能寄給家屬', () => {
    assert.throws(() => assertRecipientKindMatches('settlement_published', 'family'), CareRuleError)
    assert.throws(() => assertRecipientKindMatches('quality_follow_up_requested', 'family'), CareRuleError)
  })
  test('相符時通過', () => {
    assert.doesNotThrow(() => assertRecipientKindMatches('family_summary_published', 'family'))
    assert.doesNotThrow(() => assertRecipientKindMatches('staff_schedule_updated', 'staff'))
  })
})

describe('通知偏好', () => {
  test('沒設定過就用預設值：開', () => {
    assert.equal(shouldCreateInApp('service_progress', null), true)
  })
  test('關掉的類別不再建立', () => {
    assert.equal(shouldCreateInApp('service_progress', { in_app_enabled: false }), false)
  })
  test('必要類別即使關掉仍會建立', () => {
    assert.equal(shouldCreateInApp('action_needed', { in_app_enabled: false }), true)
    assert.equal(shouldCreateInApp('summary_published', { in_app_enabled: false }), true)
  })
})

describe('外部發送：本輪永遠不成立', () => {
  test('feature flag 是硬編的 false，不從環境變數讀', () => {
    assert.equal(EXTERNAL_NOTIFICATION_ENABLED, false)
  })

  test('沒有 provider 時一律 not_configured，即使使用者已 opt-in', () => {
    const r = resolveOutboxStatus({ providerConfigured: false, optedIn: true, authorizationActive: true })
    assert.equal(r.status, 'not_configured')
    assert.equal(r.reason, 'no_provider_configured')
  })

  test('狀態清單裡沒有 sent 或 delivered', () => {
    for (const bad of ['sent', 'delivered', 'sent_or_confirmed', 'success']) {
      assert.equal((OUTBOX_STATUSES as readonly string[]).includes(bad), false)
    }
  })

  test('想標記為已送出會被擋下', () => {
    for (const bad of ['sent', 'delivered', 'sent_or_confirmed', 'success']) {
      assert.throws(() => assertOutboxNeverSent(bad), CareRuleError)
    }
  })

  test('授權撤回優先於未 opt-in（就算未來 provider 上線也一樣）', () => {
    const r = resolveOutboxStatus({ providerConfigured: true, optedIn: false, authorizationActive: false })
    assert.equal(r.status, 'suppressed')
    assert.equal(r.reason, 'authorization_revoked')
  })

  test('未 opt-in 也是 suppressed，不會偷偷發送', () => {
    const r = resolveOutboxStatus({ providerConfigured: true, optedIn: false, authorizationActive: true })
    assert.equal(r.status, 'suppressed')
    assert.equal(r.reason, 'recipient_not_opted_in')
  })
})

describe('回饋資格', () => {
  const base = { bookingStatus: '已完成', summaryPublished: true, hasSummaryAuthorization: true }

  test('三個條件同時成立才可以', () => {
    assert.equal(isFeedbackEligible(base), true)
  })
  test('服務未完成不行', () => {
    assert.equal(isFeedbackEligible({ ...base, bookingStatus: '服務中' }), false)
  })
  test('小結未發布不行', () => {
    assert.equal(isFeedbackEligible({ ...base, summaryPublished: false }), false)
  })
  test('沒有授權一律不行（付款人不會自動 eligible）', () => {
    assert.equal(isFeedbackEligible({ ...base, hasSummaryAuthorization: false }), false)
  })
  test('沒有授權時的錯誤訊息講的是授權，不是服務狀態', () => {
    assert.throws(
      () => assertFeedbackEligible({ ...base, hasSummaryAuthorization: false, bookingStatus: '服務中' }),
      /授權/)
  })
})

describe('指標去識別化', () => {
  test('樣本不足就不給數字', () => {
    const r = averageOrSuppressed([5, 5, 4])
    assert.equal(r.suppressed, true)
    assert.equal(r.value, null)
    assert.equal(r.sample, 3)
  })
  test('達到門檻才給平均', () => {
    const r = averageOrSuppressed([5, 5, 4, 4, 5])
    assert.equal(r.suppressed, false)
    assert.equal(r.value, 4.6)
    assert.equal(r.sample, 5)
  })
  test('空陣列也是 suppressed，不會變成 NaN', () => {
    const r = averageOrSuppressed([])
    assert.equal(r.suppressed, true)
    assert.equal(r.value, null)
  })
  test('門檻至少是 5', () => {
    assert.ok(MIN_INSIGHT_SAMPLE >= 5)
  })
})

describe('對外視圖的白名單', () => {
  test('意見案件的公開狀態不含內部備註與負責人', () => {
    const out = toConcernPublicStatus({
      id: 1, category: 'communication', status: 'acknowledged',
      created_at: '2026-08-01T00:00:00Z', resolved_at: null, resolution_code: null,
    } as any)
    const keys = Object.keys(out)
    for (const leaked of ['internal_note', 'owner_admin_id', 'description', 'due_date', 'source_user_id']) {
      assert.equal(keys.includes(leaked), false, `外洩了 ${leaked}`)
    }
  })

  test('陪診員的改善事項摘要不含督導備註與其他人資料', () => {
    const out = toFollowUpStaffView({
      id: 3, action_code: 'record_timeliness', staff_visible_note: '請在當天送審',
      due_date: '2026-09-01', status: 'open',
    } as any)
    const keys = Object.keys(out)
    for (const leaked of ['review_id', 'owner_admin_id', 'internal_note', 'verified_by_admin_id']) {
      assert.equal(keys.includes(leaked), false, `外洩了 ${leaked}`)
    }
    assert.equal(out.note, '請在當天送審')
  })
})

describe('接受政策不會推導出任何其他授權', () => {
  test('三件事都是 false', () => {
    const r = policyAcceptanceImpliesNothing()
    assert.equal(r.grantsServiceAuthorization, false)
    assert.equal(r.grantsConsent, false)
    assert.equal(r.grantsExternalOptIn, false)
  })
})

describe('資料生命週期', () => {
  test('本輪不刪除任何資料', () => {
    assert.equal(LIFECYCLE_DELETION_ENABLED, false)
  })
})

describe('上線檢核只從真實狀態算', () => {
  const allGood = {
    migrationsApplied: true,
    externalNotificationEnabled: false,
    photoAttachmentEnabled: false,
    realPaymentEnabled: false,
    publishedPolicyKinds: [
      'terms_of_service', 'privacy_notice', 'cancellation_rules', 'family_handover_notice'],
    monitoringProvider: 'sentry',
    companionsWithoutEmployment: 0,
    companionsWithoutVerifiedCapability: 0,
    openIncidents: 0,
    overdueConcerns: 0,
    broadAccessAdmins: 1,
  }

  test('條款沒發布就是 blocked，不會假裝已核准', () => {
    const checks = buildReadinessChecks({ ...allGood, publishedPolicyKinds: [] })
    const policy = checks.filter(c => c.key.startsWith('policy_'))
    assert.equal(policy.length, 4)
    assert.ok(policy.every(c => c.state === 'blocked'))
  })

  test('沒有監控 provider 就顯示未設定，不會顯示 ready', () => {
    const checks = buildReadinessChecks({ ...allGood, monitoringProvider: null })
    const m = checks.find(c => c.key === 'monitoring')!
    assert.equal(m.state, 'blocked')
    assert.match(m.detail, /未設定/)
  })

  test('外部通知被打開會變成 blocked', () => {
    const checks = buildReadinessChecks({ ...allGood, externalNotificationEnabled: true })
    assert.equal(checks.find(c => c.key === 'flag_external_notification')!.state, 'blocked')
  })

  test('migration 未套用時第一項就是 blocked', () => {
    const checks = buildReadinessChecks({ ...allGood, migrationsApplied: false })
    assert.equal(checks.find(c => c.key === 'migrations')!.state, 'blocked')
  })

  test('陪診員缺少僱用條件或能力驗證會被標出來', () => {
    const checks = buildReadinessChecks({
      ...allGood, companionsWithoutEmployment: 2, companionsWithoutVerifiedCapability: 1 })
    assert.equal(checks.find(c => c.key === 'staff_employment')!.state, 'blocked')
    assert.equal(checks.find(c => c.key === 'staff_capability')!.state, 'blocked')
  })

  test('人工待決項目永遠是 blocked —— 程式無從判斷', () => {
    const checks = buildReadinessChecks(allGood)
    const manual = checks.filter(c => c.key.startsWith('manual_'))
    assert.ok(manual.length >= 6)
    assert.ok(manual.every(c => c.state === 'blocked' && c.manual))
  })

  test('即使其他都通過，整體仍不會是 ready（因為有人工待決）', () => {
    const s = summarizeReadiness(buildReadinessChecks(allGood))
    assert.equal(s.overall, 'blocked')
    assert.ok(s.manualBlocked >= 6)
  })

  test('沒有任何「手動標記為完成」的欄位', () => {
    const checks = buildReadinessChecks(allGood)
    for (const c of checks) {
      assert.equal(Object.keys(c).includes('manually_confirmed'), false)
      assert.equal(Object.keys(c).includes('override'), false)
    }
  })
})

describe('營運讀取權限的範圍', () => {
  test('不含結算權限——財務不該讀到品質與家屬意見', () => {
    assert.equal(OPERATIONS_READ_PERMISSIONS.includes('care_settlement.manage'), false)
  })
  test('不含個資生命週期權限', () => {
    assert.equal(
      OPERATIONS_READ_PERMISSIONS.includes(CLOSURE_PERMISSION_KEYS.lifecycle), false)
  })
  test('含品質、回饋、意見與通知權限', () => {
    for (const k of ['qualityReview', 'qualityManage', 'feedback', 'concern', 'notification'] as const) {
      assert.ok(OPERATIONS_READ_PERMISSIONS.includes(CLOSURE_PERMISSION_KEYS[k]), `缺少 ${k}`)
    }
  })
})
