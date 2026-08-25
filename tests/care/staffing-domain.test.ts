import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLegacyEmploymentType, isEmploymentActive, periodsOverlap,
  hasVerifiedCapability, requiredCapabilitiesFor,
  coversDate, isProposalOpen, toProposalSummary, rulesOverlap,
  evaluateMatch, assertMatchable, PROPOSAL_TRANSITIONS, TIME_OFF_TRANSITIONS,
  canTransition, CareRuleError,
  type ProposalStatus, type TimeOffStatus,
} from '../../lib/care/staffing/domain.ts'

describe('僱用型態', () => {
  test('舊值對應明確，不是猜的', () => {
    assert.equal(normalizeLegacyEmploymentType('fulltime'), 'full_time')
    assert.equal(normalizeLegacyEmploymentType('parttime'), 'part_time')
    assert.equal(normalizeLegacyEmploymentType('contractor'), null, '無法對應要回 null 由人工處理')
    assert.equal(normalizeLegacyEmploymentType(null), null)
  })

  test('有效期間判斷', () => {
    const t = { status: 'active', effective_from: '2026-01-01', effective_to: null }
    assert.ok(isEmploymentActive(t, '2026-09-01'))
    assert.equal(isEmploymentActive(t, '2025-12-31'), false, '生效前不算')
    assert.equal(isEmploymentActive({ ...t, effective_to: '2026-06-30' }, '2026-09-01'), false)
  })

  test('paused 與 ended 都不算有效', () => {
    const base = { effective_from: '2026-01-01', effective_to: null }
    assert.equal(isEmploymentActive({ ...base, status: 'paused' }, '2026-09-01'), false)
    assert.equal(isEmploymentActive({ ...base, status: 'ended' }, '2026-09-01'), false)
    assert.equal(isEmploymentActive(null, '2026-09-01'), false)
  })

  test('期間重疊偵測（含開放結束日）', () => {
    assert.ok(periodsOverlap({ from: '2026-01-01', to: null }, { from: '2026-06-01', to: null }))
    assert.ok(periodsOverlap({ from: '2026-01-01', to: '2026-06-30' }, { from: '2026-06-30', to: null }))
    assert.equal(periodsOverlap({ from: '2026-01-01', to: '2026-05-31' }, { from: '2026-06-01', to: null }), false)
  })
})

describe('能力驗證', () => {
  const rows = [
    { capability_code: 'general_outpatient_flow', status: 'verified', expires_at: null },
    { capability_code: 'wheelchair_route_support', status: 'verified', expires_at: '2026-06-30' },
    { capability_code: 'dementia_communication', status: 'suspended', expires_at: null },
  ]
  test('已驗證且未過期才算數', () => {
    assert.ok(hasVerifiedCapability(rows, 'general_outpatient_flow', '2026-09-01'))
    assert.equal(hasVerifiedCapability(rows, 'wheelchair_route_support', '2026-09-01'), false, '已過期')
    assert.ok(hasVerifiedCapability(rows, 'wheelchair_route_support', '2026-06-01'))
  })
  test('suspended 不算', () => {
    assert.equal(hasVerifiedCapability(rows, 'dementia_communication', '2026-09-01'), false)
  })
  test('沒有紀錄一律不算', () => {
    assert.equal(hasVerifiedCapability([], 'general_outpatient_flow', '2026-09-01'), false)
    assert.equal(hasVerifiedCapability(null, 'general_outpatient_flow', '2026-09-01'), false)
  })
  test('術後情境需要額外能力', () => {
    assert.deepEqual(requiredCapabilitiesFor('post_procedure_discharge'),
      ['general_outpatient_flow', 'post_procedure_discharge_protocol'])
  })
  test('輪椅需求會自動加上動線能力', () => {
    const r = requiredCapabilitiesFor('routine_visit', 'wheelchair')
    assert.ok(r.includes('wheelchair_route_support'))
  })
  test('未知情境退回最基本能力，不會變成沒有要求', () => {
    assert.deepEqual(requiredCapabilitiesFor('whatever'), ['general_outpatient_flow'])
  })
})

describe('請假涵蓋', () => {
  const rows = [
    { start_date: '2026-09-01', end_date: '2026-09-05', status: 'approved' },
    { start_date: '2026-10-01', end_date: '2026-10-03', status: 'submitted' },
  ]
  test('只有已核准才擋', () => {
    assert.ok(coversDate(rows, '2026-09-03'))
    assert.ok(coversDate(rows, '2026-09-01'), '含頭')
    assert.ok(coversDate(rows, '2026-09-05'), '含尾')
    assert.equal(coversDate(rows, '2026-10-02'), false, '待審核不擋')
    assert.equal(coversDate(rows, '2026-09-06'), false)
  })
  test('請假狀態機：核准後是終態', () => {
    assert.ok(canTransition<TimeOffStatus>(TIME_OFF_TRANSITIONS, 'submitted', 'approved'))
    assert.equal(canTransition<TimeOffStatus>(TIME_OFF_TRANSITIONS, 'approved', 'cancelled'), false)
  })
})

describe('邀請', () => {
  const future = new Date(Date.now() + 3600_000).toISOString()
  const past = new Date(Date.now() - 3600_000).toISOString()

  test('未逾時的 proposed 才可回覆', () => {
    assert.ok(isProposalOpen({ status: 'proposed', expires_at: future }))
    assert.equal(isProposalOpen({ status: 'proposed', expires_at: past }), false, '逾時')
    assert.equal(isProposalOpen({ status: 'accepted', expires_at: future }), false)
    assert.equal(isProposalOpen({ status: 'cancelled', expires_at: future }), false)
  })

  test('accepted / declined / expired / cancelled 都是終態', () => {
    for (const s of ['accepted', 'declined', 'expired', 'cancelled'] as ProposalStatus[]) {
      assert.deepEqual(PROPOSAL_TRANSITIONS[s], [], `${s} 應為終態`)
    }
  })

  test('接受前的摘要不含任何敏感欄位', () => {
    const booking = {
      id: 100, service_date: '2026-09-10', time_slot: 'morning',
      county: '台北市', hospital: '台大醫院 3F 心臟內科', service_name: '標準陪診',
      patient_name: '王老先生', contact_name: '王小姐', contact_phone: '0912345678',
      contact_line: 'wang123', notes: '長輩重聽，有高血壓病史',
      price: 1800, companion_fee: 1100,
      pickup_address: '台北市大安區某路 1 號', department: '心臟內科', mobility: 'wheelchair',
    }
    const s = toProposalSummary({ id: 7, expires_at: future }, booking, ['general_outpatient_flow'])
    const json = JSON.stringify(s)

    for (const leak of ['王老先生', '王小姐', '0912345678', 'wang123', '高血壓',
                        '1800', '1100', '大安區', '台大醫院', '心臟內科']) {
      assert.equal(json.includes(leak), false, `摘要不該含「${leak}」：${json}`)
    }
    assert.equal(s.county, '台北市', '只給縣市')
    assert.equal(s.service_date, '2026-09-10')
    assert.equal(s.mobility, 'wheelchair', '行動協助需求要給，才知道接不接得下')
  })

  test('摘要的欄位是固定白名單，不會夾帶原始欄位', () => {
    const s = toProposalSummary({ id: 7, expires_at: future },
      { id: 1, service_date: '2026-09-10', secret_field: 'x' } as any, [])
    assert.deepEqual(Object.keys(s).sort(), [
      'county', 'expires_at', 'mobility', 'proposal_id',
      'required_capabilities', 'service_date', 'service_name', 'time_slot',
    ])
  })
})

describe('可服務時段衝突', () => {
  test('同一天時間重疊才算衝突', () => {
    const a = { weekday: 1, start_time: '09:00', end_time: '12:00' }
    assert.ok(rulesOverlap(a, { weekday: 1, start_time: '11:00', end_time: '14:00' }))
    assert.equal(rulesOverlap(a, { weekday: 2, start_time: '11:00', end_time: '14:00' }), false, '不同天')
    assert.equal(rulesOverlap(a, { weekday: 1, start_time: '12:00', end_time: '14:00' }), false, '剛好接續不算重疊')
  })
})

describe('媒合檢查', () => {
  const okCandidate = {
    companion_status: 'active',
    employment: { status: 'active', employment_type: 'part_time', effective_from: '2026-01-01', effective_to: null },
    regions: ['台北市'],
    verifications: [{ capability_code: 'general_outpatient_flow', status: 'verified', expires_at: null }],
    timeOff: [],
    conflictingCount: 0,
    availabilityWeekdays: [4],
  }
  const ctx = {
    serviceDate: '2026-09-10', weekday: 4, county: '台北市',
    requiredCapabilities: ['general_outpatient_flow'],
    wantEmploymentType: 'part_time' as const, bookingAssigned: false,
  }

  test('全部符合時通過', () => {
    assert.deepEqual(evaluateMatch(okCandidate, ctx), { ok: true, failures: [] })
  })

  test('一次回報所有不符原因，不是只回第一個', () => {
    const r = evaluateMatch({
      ...okCandidate,
      companion_status: 'suspended',
      regions: ['高雄市'],
      verifications: [],
      timeOff: [{ start_date: '2026-09-10', end_date: '2026-09-10', status: 'approved' }],
      conflictingCount: 1,
    }, ctx)
    assert.equal(r.ok, false)
    for (const c of ['staff_inactive', 'region_mismatch', 'capability_not_verified',
                     'time_off_approved', 'schedule_conflict']) {
      assert.ok(r.failures.includes(c as any), `應包含 ${c}：${r.failures}`)
    }
  })

  test('已指派的服務不能再媒合', () => {
    const r = evaluateMatch(okCandidate, { ...ctx, bookingAssigned: true })
    assert.ok(r.failures.includes('already_assigned'))
  })

  test('僱用型態不符會被擋（全職不能走邀請）', () => {
    const r = evaluateMatch(
      { ...okCandidate, employment: { ...okCandidate.employment, employment_type: 'full_time' } }, ctx)
    assert.ok(r.failures.includes('employment_type_mismatch'))
  })

  test('沒有僱用條件一律擋下', () => {
    const r = evaluateMatch({ ...okCandidate, employment: null }, ctx)
    assert.ok(r.failures.includes('employment_inactive'))
  })

  test('兼職不在可服務星期會被擋，全職不受此限', () => {
    const wrongDay = { ...ctx, weekday: 2 }
    assert.ok(evaluateMatch(okCandidate, wrongDay).failures.includes('availability_mismatch'))

    const fullTime = {
      ...okCandidate,
      employment: { ...okCandidate.employment, employment_type: 'full_time' },
    }
    const r = evaluateMatch(fullTime, { ...wrongDay, wantEmploymentType: 'full_time' as const })
    assert.equal(r.failures.includes('availability_mismatch'), false, '全職以公司班表為準')
  })

  test('沒有設定任何週期時段時不硬性擋（尚未設定 ≠ 不可服務）', () => {
    const r = evaluateMatch({ ...okCandidate, availabilityWeekdays: [] }, { ...ctx, weekday: 2 })
    assert.equal(r.failures.includes('availability_mismatch'), false)
  })

  test('assertMatchable 把原因組成可讀訊息', () => {
    try {
      assertMatchable(evaluateMatch({ ...okCandidate, regions: ['高雄市'] }, ctx))
      assert.fail('應該要丟錯')
    } catch (e) {
      assert.ok(e instanceof CareRuleError)
      assert.match((e as Error).message, /服務區域不符/)
    }
  })
})
