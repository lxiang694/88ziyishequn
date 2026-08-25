import { test, describe, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { CareRuleError } from '../../lib/care/staffing/domain.ts'

interface Row { [k: string]: any }
const db = {
  companions: new Map<number, Row>(),
  terms: new Map<number, Row>(),
  regions: [] as Row[],
  vers: new Map<number, Row[]>(),
  rules: new Map<number, Row>(),
  timeOff: new Map<number, Row>(),
  proposals: new Map<number, Row>(),
  bookings: new Map<number, Row>(),
  seq: 0,
}
const nextId = () => ++db.seq
const future = () => new Date(Date.now() + 3600_000).toISOString()

function reset() {
  db.companions.clear(); db.terms.clear(); db.rules.clear(); db.timeOff.clear()
  db.proposals.clear(); db.bookings.clear(); db.vers.clear(); db.regions = []; db.seq = 100

  for (const [id, type] of [[1, 'part_time'], [2, 'part_time'], [3, 'full_time']] as const) {
    db.companions.set(id, { id, name: `陪診員${id}`, phone: `090000000${id}`, status: 'active' })
    db.terms.set(id, {
      id: 900 + id, companion_id: id, employment_type: type, status: 'active',
      effective_from: '2020-01-01', effective_to: null,
    })
    db.regions.push({ companion_id: id, region: '台北市' })
    db.vers.set(id, [{ companion_id: id, capability_code: 'general_outpatient_flow', status: 'verified', expires_at: null }])
  }
  db.bookings.set(500, {
    id: 500, booking_no: 'CB500', service_date: '2026-09-10', time_slot: 'morning',
    county: '台北市', hospital: '台大醫院 3F', service_name: '標準陪診',
    patient_name: '王老先生', contact_name: '王小姐', contact_phone: '0912345678',
    notes: '長輩重聽', price: 1800, companion_fee: 1100,
    status: '已付款', companion_id: null, service_code: 'routine_visit', mobility: 'walk',
  })
}

/** 模擬資料庫函式的 row lock：同步檢查並指派，最多一個成功 */
function acceptRpc(proposalId: number, companionId: number) {
  const p = db.proposals.get(proposalId)
  if (!p) return { ok: false, reason: 'proposal_not_found', out_booking_id: null }
  if (p.companion_id !== companionId) return { ok: false, reason: 'not_your_proposal', out_booking_id: null }
  if (p.status !== 'proposed') return { ok: false, reason: 'proposal_not_open', out_booking_id: null }
  if (new Date(p.expires_at) <= new Date()) {
    p.status = 'expired'
    return { ok: false, reason: 'proposal_expired', out_booking_id: null }
  }
  const term = db.terms.get(companionId)
  if (!term || term.status !== 'active') return { ok: false, reason: 'employment_inactive', out_booking_id: null }

  const b = db.bookings.get(p.booking_id)!
  if (b.companion_id !== null) {
    p.status = 'cancelled'
    return { ok: false, reason: 'already_assigned', out_booking_id: null }
  }
  b.companion_id = companionId
  b.status = '已派工'
  p.status = 'accepted'
  p.responded_at = new Date().toISOString()
  for (const o of db.proposals.values()) {
    if (o.booking_id === p.booking_id && o.id !== p.id && o.status === 'proposed') o.status = 'cancelled'
  }
  return { ok: true, reason: 'ok', out_booking_id: p.booking_id }
}

mock.module('../../lib/care/staffing/repository.ts', {
  namedExports: {
    CareTableMissingError: class extends Error {},
    listCompanions: async () => [...db.companions.values()],
    getCompanionBasic: async (id: number) => db.companions.get(id) || null,
    listEmploymentTerms: async (id: number) => [...db.terms.values()].filter(t => t.companion_id === id),
    getActiveEmploymentTerm: async (id: number) => {
      const t = db.terms.get(id)
      return t && t.status === 'active' ? t : null
    },
    insertEmploymentTerm: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.terms.set(r.companion_id as number, x); return x },
    updateEmploymentTerm: async (id: number, p: Row) => {
      for (const t of db.terms.values()) if (t.id === id) Object.assign(t, p)
    },
    listCompanionsMissingEmployment: async () => [],
    listRegions: async (id: number) => db.regions.filter(r => r.companion_id === id).map(r => r.region),
    listRegionsForMany: async (ids: number[]) => {
      const o: Record<number, string[]> = {}
      for (const r of db.regions) if (ids.includes(r.companion_id)) (o[r.companion_id] ||= []).push(r.region)
      return o
    },
    addRegion: async (id: number, region: string) => { db.regions.push({ companion_id: id, region }) },
    removeRegion: async (id: number, region: string) => {
      db.regions = db.regions.filter(r => !(r.companion_id === id && r.region === region))
    },
    listCapabilities: async () => [],
    listVerifications: async (id: number) => db.vers.get(id) || [],
    listVerificationsForMany: async (ids: number[]) => {
      const o: Record<number, Row[]> = {}
      for (const id of ids) o[id] = db.vers.get(id) || []
      return o
    },
    upsertVerification: async (r: Row) => {
      const list = db.vers.get(r.companion_id as number) || []
      const i = list.findIndex(v => v.capability_code === r.capability_code)
      if (i >= 0) list[i] = { ...list[i], ...r }; else list.push(r)
      db.vers.set(r.companion_id as number, list)
    },
    setVerificationStatus: async (id: number, code: string, status: string) => {
      const list = db.vers.get(id) || []
      for (const v of list) if (v.capability_code === code) v.status = status
    },
    listAvailabilityRules: async (id: number) => [...db.rules.values()].filter(r => r.companion_id === id),
    listActiveWeekdaysForMany: async (ids: number[]) => {
      const o: Record<number, number[]> = {}
      for (const r of db.rules.values()) {
        if (ids.includes(r.companion_id) && r.active) (o[r.companion_id] ||= []).push(r.weekday)
      }
      return o
    },
    insertAvailabilityRule: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.rules.set(id, x); return x },
    getAvailabilityRule: async (id: number) => db.rules.get(id) || null,
    updateAvailabilityRule: async (id: number, p: Row) => { Object.assign(db.rules.get(id)!, p) },
    listTimeOff: async (id: number) => [...db.timeOff.values()].filter(t => t.companion_id === id),
    listTimeOffByStatus: async () => [...db.timeOff.values()],
    listApprovedTimeOffForMany: async (ids: number[]) => {
      const o: Record<number, Row[]> = {}
      for (const t of db.timeOff.values()) {
        if (ids.includes(t.companion_id) && t.status === 'approved') (o[t.companion_id] ||= []).push(t)
      }
      return o
    },
    insertTimeOff: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.timeOff.set(id, x); return x },
    getTimeOff: async (id: number) => db.timeOff.get(id) || null,
    updateTimeOff: async (id: number, p: Row) => { Object.assign(db.timeOff.get(id)!, p) },
    insertProposal: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.proposals.set(id, x); return x },
    getProposal: async (id: number) => db.proposals.get(id) || null,
    updateProposal: async (id: number, p: Row) => { Object.assign(db.proposals.get(id)!, p) },
    listProposals: async () => [...db.proposals.values()],
    listOwnOpenProposals: async (id: number) => [...db.proposals.values()]
      .filter(p => p.companion_id === id && p.status === 'proposed' && new Date(p.expires_at) > new Date()),
    countConflicts: async (id: number, date: string) => {
      let n = 0
      for (const b of db.bookings.values()) {
        if (b.companion_id === id && b.service_date === date && b.status !== '已取消') n++
      }
      for (const p of db.proposals.values()) {
        if (p.companion_id === id && p.status === 'proposed') {
          const b = db.bookings.get(p.booking_id)
          if (b && b.service_date === date) n++
        }
      }
      return n
    },
    getBooking: async (id: number) => db.bookings.get(id) || null,
    updateBooking: async (id: number, p: Row) => { Object.assign(db.bookings.get(id)!, p) },
    getCase: async () => null,
    updateCase: async () => {},
    getIntake: async () => null,
    listMatchableCases: async () => [],
    insertBooking: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.bookings.set(id, x); return x },
    listUnassignedBookings: async () => [...db.bookings.values()].filter(b => !b.companion_id),
    callAcceptProposal: async (pid: number, cid: number) => acceptRpc(pid, cid),
    expireStaleProposals: async () => 0,
  },
})

mock.module('@/lib/supabase', {
  namedExports: {
    supabaseAdmin: {
      from: () => ({
        update: () => ({ eq: async () => ({ error: null }) }),
        select: () => ({
          eq: () => ({ gte: () => ({ lte: () => ({ not: async () => ({ count: 0 }) }) }) }),
        }),
      }),
    },
    supabase: {},
  },
})

const svc = await import('../../lib/care/staffing/service.ts')
const v = await import('../../lib/care/staffing/validation.ts')

const admin = { id: 9, name: '督導', account: 'sup' }
const staffA = { id: 1, name: '陪診員1' }
const staffB = { id: 2, name: '陪診員2' }

beforeEach(reset)

describe('兼職邀請：只能邀請，不能直接指派', () => {
  test('建立邀請不會設定 companion_id', async () => {
    const r = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    assert.ok(r.proposalId)
    assert.equal(db.bookings.get(500)!.companion_id, null, '邀請階段不可指派')
    assert.equal(db.bookings.get(500)!.status, '已付款')
  })

  test('全職不能被建立成兼職邀請', async () => {
    await assert.rejects(() => svc.createPartTimeDispatchProposal(500, 3, 24, admin), CareRuleError)
  })

  test('兼職不能被直接建立全職指派', async () => {
    await assert.rejects(() => svc.createFullTimeAssignment(500, 1, admin), CareRuleError)
  })

  test('全職指派會直接設定 companion_id', async () => {
    await svc.createFullTimeAssignment(500, 3, admin)
    assert.equal(db.bookings.get(500)!.companion_id, 3)
    assert.equal(db.bookings.get(500)!.status, '已派工')
  })
})

describe('接受邀請：並發保護', () => {
  test('接受後才建立正式指派', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    assert.equal(db.bookings.get(500)!.companion_id, null)
    await svc.acceptOwnDispatchProposal(p.proposalId, staffA)
    assert.equal(db.bookings.get(500)!.companion_id, 1)
    assert.equal(db.proposals.get(p.proposalId)!.status, 'accepted')
  })

  test('兩人同時接受同一筆服務，只有一個成功', async () => {
    const pa = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    const pb = await svc.createPartTimeDispatchProposal(500, 2, 24, admin)

    const results = await Promise.allSettled([
      svc.acceptOwnDispatchProposal(pa.proposalId, staffA),
      svc.acceptOwnDispatchProposal(pb.proposalId, staffB),
    ])
    const ok = results.filter(r => r.status === 'fulfilled')
    assert.equal(ok.length, 1, '只能有一個成功')

    const b = db.bookings.get(500)!
    assert.ok(b.companion_id === 1 || b.companion_id === 2)
    const accepted = [...db.proposals.values()].filter(p => p.status === 'accepted')
    assert.equal(accepted.length, 1, '只能有一個 accepted')
  })

  test('有人接受後，其他未回覆的邀請立即被撤回', async () => {
    const pa = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    const pb = await svc.createPartTimeDispatchProposal(500, 2, 24, admin)
    await svc.acceptOwnDispatchProposal(pa.proposalId, staffA)
    assert.equal(db.proposals.get(pb.proposalId)!.status, 'cancelled')

    // 讀取範圍立即收回
    const summaries = await svc.listOwnProposalSummaries(staffB)
    assert.equal(summaries.length, 0)
  })

  test('不能接受別人的邀請', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    await assert.rejects(() => svc.acceptOwnDispatchProposal(p.proposalId, staffB), CareRuleError)
    assert.equal(db.bookings.get(500)!.companion_id, null)
  })

  test('逾時的邀請不能接受', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    db.proposals.get(p.proposalId)!.expires_at = new Date(Date.now() - 1000).toISOString()
    await assert.rejects(() => svc.acceptOwnDispatchProposal(p.proposalId, staffA), CareRuleError)
    assert.equal(db.bookings.get(500)!.companion_id, null)
  })

  test('已取消的邀請不能接受', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    await svc.cancelDispatchProposal(p.proposalId, admin)
    await assert.rejects(() => svc.acceptOwnDispatchProposal(p.proposalId, staffA), CareRuleError)
  })

  test('僱用條件失效時不能接受', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    db.terms.get(1)!.status = 'paused'
    await assert.rejects(() => svc.acceptOwnDispatchProposal(p.proposalId, staffA), CareRuleError)
    assert.equal(db.bookings.get(500)!.companion_id, null)
  })
})

describe('邀請摘要：接受前不洩露敏感資料', () => {
  test('摘要不含就診人、電話、醫院、備註、金額', async () => {
    await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    const s = await svc.listOwnProposalSummaries(staffA)
    assert.equal(s.length, 1)
    const json = JSON.stringify(s)
    for (const leak of ['王老先生', '王小姐', '0912345678', '長輩重聽', '1800', '1100', '台大醫院']) {
      assert.equal(json.includes(leak), false, `不該含「${leak}」：${json}`)
    }
    assert.equal(s[0].county, '台北市')
  })

  test('婉拒後就看不到了', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    await svc.declineOwnDispatchProposal(p.proposalId, 'schedule_conflict', null, staffA)
    assert.deepEqual(await svc.listOwnProposalSummaries(staffA), [])
  })

  test('不能婉拒別人的邀請', async () => {
    const p = await svc.createPartTimeDispatchProposal(500, 1, 24, admin)
    await assert.rejects(
      () => svc.declineOwnDispatchProposal(p.proposalId, 'too_far', null, staffB), CareRuleError)
  })
})

describe('可服務時段：本人限定且不可衝突', () => {
  const rule = v.parseAvailabilityRule({ weekday: 1, start_time: '09:00', end_time: '12:00' })

  test('可建立自己的時段', async () => {
    const r = await svc.setOwnAvailabilityRule(rule, staffA)
    assert.equal(db.rules.get(r.ruleId)!.companion_id, 1)
  })

  test('重疊的時段被擋下', async () => {
    await svc.setOwnAvailabilityRule(rule, staffA)
    const overlap = v.parseAvailabilityRule({ weekday: 1, start_time: '11:00', end_time: '14:00' })
    await assert.rejects(() => svc.setOwnAvailabilityRule(overlap, staffA), CareRuleError)
  })

  test('不同天不算衝突', async () => {
    await svc.setOwnAvailabilityRule(rule, staffA)
    const other = v.parseAvailabilityRule({ weekday: 2, start_time: '09:00', end_time: '12:00' })
    await assert.doesNotReject(() => svc.setOwnAvailabilityRule(other, staffA))
  })

  test('不能修改或停用別人的時段', async () => {
    const r = await svc.setOwnAvailabilityRule(rule, staffA)
    await assert.rejects(() => svc.updateOwnAvailabilityRule(r.ruleId, rule, staffB), CareRuleError)
    await assert.rejects(() => svc.disableOwnAvailabilityRule(r.ruleId, staffB), CareRuleError)
  })
})

describe('請假', () => {
  const req = v.parseTimeOff({
    request_type: 'leave', start_date: '2026-09-10', end_date: '2026-09-12', reason_code: 'personal',
  })

  test('可提交與取消自己的申請', async () => {
    const r = await svc.submitOwnTimeOffRequest(req, staffA)
    await svc.cancelOwnTimeOffRequest(r.requestId, staffA)
    assert.equal(db.timeOff.get(r.requestId)!.status, 'cancelled')
  })

  test('不能取消別人的申請', async () => {
    const r = await svc.submitOwnTimeOffRequest(req, staffA)
    await assert.rejects(() => svc.cancelOwnTimeOffRequest(r.requestId, staffB), CareRuleError)
  })

  test('已核准的請假不能再取消', async () => {
    const r = await svc.submitOwnTimeOffRequest(req, staffA)
    await svc.reviewStaffTimeOffRequest(r.requestId, 'approve', null, admin)
    await assert.rejects(() => svc.cancelOwnTimeOffRequest(r.requestId, staffA), CareRuleError)
  })

  test('核准的請假會擋下該日媒合', async () => {
    const r = await svc.submitOwnTimeOffRequest(req, staffA)
    await svc.reviewStaffTimeOffRequest(r.requestId, 'approve', null, admin)
    await assert.rejects(() => svc.createPartTimeDispatchProposal(500, 1, 24, admin), CareRuleError)
  })
})

describe('媒合候選清單', () => {
  test('列出所有人並附上不符原因', async () => {
    db.regions = db.regions.filter(r => r.companion_id !== 2)
    const { candidates } = await svc.listDispatchCandidates(500, 'part_time')
    const c2 = candidates.find(c => c.companion.id === 2)!
    assert.equal(c2.result.ok, false)
    assert.ok(c2.failureMessages.some(m => m.includes('服務區域')))
    const c1 = candidates.find(c => c.companion.id === 1)!
    assert.equal(c1.result.ok, true)
  })

  test('合格的排在前面', async () => {
    db.companions.get(1)!.status = 'suspended'
    const { candidates } = await svc.listDispatchCandidates(500, 'part_time')
    assert.equal(candidates[0].result.ok, true)
    assert.equal(candidates[0].companion.id, 2)
  })

  test('候選清單不含就診人或聯絡資料', async () => {
    const { candidates } = await svc.listDispatchCandidates(500, 'part_time')
    const json = JSON.stringify(candidates)
    assert.equal(json.includes('王老先生'), false)
    assert.equal(json.includes('0912345678'), false)
  })
})
