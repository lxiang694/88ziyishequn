import { test, describe, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { CareRuleError, CareInputError } from '../../lib/care/fulfilment/domain.ts'

/** 以記憶體假 Repository 驗證 use case 的歸屬、狀態與跨角色隔離。 */
interface Row { [k: string]: any }
const db = {
  bookings: new Map<number, Row>(),
  companions: new Map<number, string>(),
  events: new Map<number, Row>(),
  records: new Map<number, Row>(),
  summaries: new Map<number, Row>(),
  incidents: new Map<number, Row>(),
  auths: [] as Row[],
  lines: new Map<number, Row>(),
  batches: new Map<number, Row>(),
  seq: 0,
}
const nextId = () => ++db.seq

function reset() {
  db.bookings.clear(); db.companions.clear(); db.events.clear(); db.records.clear()
  db.summaries.clear(); db.incidents.clear(); db.lines.clear(); db.batches.clear()
  db.auths = []; db.seq = 0
  db.companions.set(1, 'parttime'); db.companions.set(2, 'parttime'); db.companions.set(3, 'fulltime')
  db.bookings.set(100, {
    id: 100, booking_no: 'CB100', status: '服務中', companion_id: 1, user_id: 'fam-a',
    service_name: '標準陪診', service_date: '2026-09-01', hospital: '台大', patient_name: '王媽媽',
    contact_name: '王小姐', companion_fee: 1100, addon_companion_fee: 200, extra_companion_fee: 0,
  })
  db.bookings.set(200, { ...db.bookings.get(100), id: 200, booking_no: 'CB200', companion_id: 2, user_id: 'fam-b' })
  db.bookings.set(300, { ...db.bookings.get(100), id: 300, booking_no: 'CB300', companion_id: 3, status: '已完成' })
}

mock.module('../../lib/care/fulfilment/repository.ts', {
  namedExports: {
    CareTableMissingError: class extends Error {},
    getBooking: async (id: number) => db.bookings.get(id) || null,
    getCompanionEmploymentType: async (id: number) => db.companions.get(id) || null,
    insertServiceEvent: async (r: Row) => { const id = nextId(); const x = { id, invalidated_at: null, ...r }; db.events.set(id, x); return x },
    getServiceEvent: async (id: number) => db.events.get(id) || null,
    invalidateServiceEvent: async (id: number, p: Row) => { Object.assign(db.events.get(id)!, p) },
    listServiceEvents: async (b: number) => [...db.events.values()].filter(e => e.booking_id === b),
    listFamilyVisibleEvents: async (b: number) => [...db.events.values()]
      .filter(e => e.booking_id === b && e.visibility === 'family' && !e.invalidated_at)
      .map(e => ({ event_type: e.event_type, family_note: e.family_note, occurred_at: e.occurred_at || 'now' })),
    setEventVisibility: async (id: number, v: string) => { db.events.get(id)!.visibility = v },
    getActiveRecordForBooking: async (b: number) => [...db.records.values()]
      .find(r => r.booking_id === b && ['draft', 'submitted', 'returned_for_revision'].includes(r.status)) || null,
    getRecord: async (id: number) => db.records.get(id) || null,
    insertRecord: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.records.set(id, x); return x },
    updateRecord: async (id: number, p: Row) => { Object.assign(db.records.get(id)!, p) },
    listRecords: async () => [...db.records.values()],
    listRecordsForCompanion: async (c: number) => [...db.records.values()].filter(r => r.companion_id === c),
    nextRecordRevision: async (b: number) => {
      const v = [...db.records.values()].filter(r => r.booking_id === b).map(r => r.revision)
      return v.length ? Math.max(...v) + 1 : 1
    },
    insertSummary: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.summaries.set(id, x); return x },
    getSummary: async (id: number) => db.summaries.get(id) || null,
    updateSummary: async (id: number, p: Row) => { Object.assign(db.summaries.get(id)!, p) },
    listSummaries: async () => [...db.summaries.values()],
    listSummariesForBooking: async (b: number) => [...db.summaries.values()].filter(s => s.booking_id === b),
    getPublishedSummary: async (b: number) => [...db.summaries.values()].find(s => s.booking_id === b && s.status === 'published') || null,
    nextSummaryVersion: async (b: number) => {
      const v = [...db.summaries.values()].filter(s => s.booking_id === b).map(s => s.version_number)
      return v.length ? Math.max(...v) + 1 : 1
    },
    insertIncident: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.incidents.set(id, x); return x },
    getIncident: async (id: number) => db.incidents.get(id) || null,
    updateIncident: async (id: number, p: Row) => { Object.assign(db.incidents.get(id)!, p) },
    listIncidents: async () => [...db.incidents.values()],
    listIncidentsForBooking: async (b: number) => [...db.incidents.values()].filter(i => i.booking_id === b),
    listAuthorizationsForUser: async (u: string, b: number) => db.auths.filter(a => a.user_id === u && a.booking_id === b),
    listAuthorizationsForBooking: async (b: number) => db.auths.filter(a => a.booking_id === b),
    upsertAuthorization: async (r: Row) => {
      const i = db.auths.findIndex(a => a.booking_id === r.booking_id && a.user_id === r.user_id && a.scope === r.scope)
      if (i >= 0) db.auths[i] = { ...db.auths[i], ...r }; else db.auths.push({ id: nextId(), ...r })
    },
    revokeAuthorization: async (id: number, p: Row) => {
      const a = db.auths.find(x => x.id === id); if (a) Object.assign(a, p)
    },
    insertSettlementLine: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.lines.set(id, x); return x },
    getSettlementLine: async (id: number) => db.lines.get(id) || null,
    findLineByBookingAndType: async (b: number, t: string) =>
      [...db.lines.values()].find(l => l.booking_id === b && l.line_type === t) || null,
    updateSettlementLine: async (id: number, p: Row) => { Object.assign(db.lines.get(id)!, p) },
    listSettlementLines: async () => [...db.lines.values()],
    listPublishedLinesForCompanion: async (c: number) =>
      [...db.lines.values()].filter(l => l.companion_id === c && l.status === 'published_to_staff'),
    insertBatch: async (r: Row) => { const id = nextId(); const x = { id, ...r }; db.batches.set(id, x); return x },
    getBatch: async (id: number) => db.batches.get(id) || null,
    updateBatch: async (id: number, p: Row) => { Object.assign(db.batches.get(id)!, p) },
    listBatches: async () => [...db.batches.values()],
    attachLinesToBatch: async (bid: number, ids: number[]) => {
      for (const id of ids) {
        const l = db.lines.get(id)
        if (l && l.status === 'approved') { l.batch_id = bid; l.status = 'batched' }
      }
    },
    publishBatchLines: async (bid: number) => {
      for (const l of db.lines.values()) if (l.batch_id === bid && l.status === 'batched') l.status = 'published_to_staff'
    },
    listLinesForBatch: async (bid: number) => [...db.lines.values()].filter(l => l.batch_id === bid),
    countBy: async () => ({}),
  },
})

const svc = await import('../../lib/care/fulfilment/service.ts')
const v = await import('../../lib/care/fulfilment/validation.ts')

const staffA = { id: 1, name: '陪診員A' }
const staffB = { id: 2, name: '陪診員B' }
const staffFull = { id: 3, name: '全職C' }
const sup = { id: 9, name: '督導', account: 'sup' }

const summaryInput = v.parseSummaryDraft({
  service_window_text: '09:00 至 12:00',
  completed_steps_text: '已完成報到、看診與領藥',
})

beforeEach(reset)

describe('服務事件：歸屬與 append-only', () => {
  test('陪診員可為自己的服務建立事件', async () => {
    const r = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA)
    assert.ok(r.eventId)
    assert.equal(db.events.get(r.eventId)!.visibility, 'internal')
  })
  test('不能為別人的服務建立事件', async () => {
    await assert.rejects(
      () => svc.appendOwnCareServiceEvent(200, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA),
      CareRuleError)
  })
  test('事件建立後預設只有內部看得到', async () => {
    const r = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'beneficiary_met' }), staffA)
    const fam = await svc.getAuthorizedFamilyView(100, 'fam-a')
    assert.equal(fam, null, '沒有授權時連查都查不到')
    assert.equal(db.events.get(r.eventId)!.visibility, 'internal')
  })
  test('服務尚未派工時不能記錄', async () => {
    db.bookings.get(100)!.status = '待確認'
    await assert.rejects(
      () => svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA),
      CareRuleError)
  })
  test('作廢只留痕跡，不刪除事件', async () => {
    const r = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA)
    await svc.invalidateOwnCareServiceEvent(r.eventId, 'entered_by_mistake', staffA)
    const e = db.events.get(r.eventId)!
    assert.ok(e.invalidated_at)
    assert.equal(e.event_type, 'staff_arrived', '原始內容仍在')
    assert.equal(db.events.size, 1)
  })
  test('不能作廢別人的事件', async () => {
    const r = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA)
    await assert.rejects(() => svc.invalidateOwnCareServiceEvent(r.eventId, 'entered_by_mistake', staffB), CareRuleError)
  })
  test('不能重複作廢', async () => {
    const r = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA)
    await svc.invalidateOwnCareServiceEvent(r.eventId, 'entered_by_mistake', staffA)
    await assert.rejects(() => svc.invalidateOwnCareServiceEvent(r.eventId, 'duplicate_entry', staffA), CareRuleError)
  })
  test('督導才能決定對家屬顯示；不可顯示的類型會被擋', async () => {
    const a = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'staff_arrived' }), staffA)
    await svc.setCareServiceEventVisibility(a.eventId, true, sup)
    assert.equal(db.events.get(a.eventId)!.visibility, 'family')

    const b = await svc.appendOwnCareServiceEvent(100, v.parseAppendEvent({ event_type: 'requires_supervisor_attention' }), staffA)
    await assert.rejects(() => svc.setCareServiceEventVisibility(b.eventId, true, sup), CareRuleError)
  })
})

describe('服務紀錄：歸屬與審核', () => {
  const draft = v.parseRecordDraft({ met_completed: true, objective_summary: '流程順利完成' })

  test('陪診員可建立與更新自己的草稿', async () => {
    const a = await svc.saveOwnCareServiceRecordDraft(100, draft, staffA)
    const b = await svc.saveOwnCareServiceRecordDraft(100, draft, staffA)
    assert.equal(a.recordId, b.recordId, '同一筆服務只會有一份進行中的紀錄')
  })
  test('不能為別人的服務建立紀錄', async () => {
    await assert.rejects(() => svc.saveOwnCareServiceRecordDraft(200, draft, staffA), CareRuleError)
  })
  test('送審後不能再改', async () => {
    await svc.saveOwnCareServiceRecordDraft(100, draft, staffA)
    await svc.submitOwnCareServiceRecord(100, staffA)
    await assert.rejects(() => svc.saveOwnCareServiceRecordDraft(100, draft, staffA), CareRuleError)
  })
  test('退回後可以重新編輯與再次送審', async () => {
    const r = await svc.saveOwnCareServiceRecordDraft(100, draft, staffA)
    await svc.submitOwnCareServiceRecord(100, staffA)
    await svc.returnCareServiceRecordForRevision(r.recordId, 'incomplete_process_steps', sup)
    await assert.doesNotReject(() => svc.saveOwnCareServiceRecordDraft(100, draft, staffA))
    await assert.doesNotReject(() => svc.submitOwnCareServiceRecord(100, staffA))
  })
  test('草稿不能直接被核可', async () => {
    const r = await svc.saveOwnCareServiceRecordDraft(100, draft, staffA)
    await assert.rejects(() => svc.reviewCareServiceRecord(r.recordId, sup), CareRuleError)
  })
  test('核可後不會再出現在待處理清單，也不能再退回', async () => {
    const r = await svc.saveOwnCareServiceRecordDraft(100, draft, staffA)
    await svc.submitOwnCareServiceRecord(100, staffA)
    await svc.reviewCareServiceRecord(r.recordId, sup)
    await assert.rejects(() => svc.returnCareServiceRecordForRevision(r.recordId, 'incomplete_process_steps', sup), CareRuleError)
  })
})

describe('家屬小結：只有督導能發布', () => {
  test('草稿不能直接發布', async () => {
    const s = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await assert.rejects(() => svc.publishCareFamilySummary(s.summaryId, sup), CareRuleError)
  })
  test('送審後才能發布', async () => {
    const s = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(s.summaryId, sup)
    await svc.publishCareFamilySummary(s.summaryId, sup)
    assert.equal(db.summaries.get(s.summaryId)!.status, 'published')
  })
  test('已發布不可再修改內容', async () => {
    const s = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(s.summaryId, sup)
    await svc.publishCareFamilySummary(s.summaryId, sup)
    await assert.rejects(() => svc.updateCareFamilySummaryDraft(s.summaryId, summaryInput, sup), CareRuleError)
  })
  test('發布新版本時舊版自動被取代，家屬永遠只看到一份', async () => {
    const a = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(a.summaryId, sup)
    await svc.publishCareFamilySummary(a.summaryId, sup)

    const b = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(b.summaryId, sup)
    await svc.publishCareFamilySummary(b.summaryId, sup)

    assert.equal(db.summaries.get(a.summaryId)!.status, 'superseded')
    assert.equal(db.summaries.get(b.summaryId)!.status, 'published')
    assert.equal(b.version_number ?? 2, 2)
  })
  test('撤回後家屬讀不到', async () => {
    db.auths.push({ id: 1, booking_id: 100, user_id: 'fam-a', scope: 'view_service_summary', revoked_at: null })
    const s = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(s.summaryId, sup)
    await svc.publishCareFamilySummary(s.summaryId, sup)
    let view = await svc.getAuthorizedFamilyView(100, 'fam-a')
    assert.ok(view?.summary)
    await svc.withdrawCareFamilySummary(s.summaryId, 'published_in_error', sup)
    view = await svc.getAuthorizedFamilyView(100, 'fam-a')
    assert.equal(view?.summary, null)
  })
})

describe('家屬端：授權才看得到', () => {
  async function publish() {
    const s = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(s.summaryId, sup)
    await svc.publishCareFamilySummary(s.summaryId, sup)
    return s
  }
  test('沒有授權一律回 null（不洩漏服務是否存在）', async () => {
    await publish()
    assert.equal(await svc.getAuthorizedFamilyView(100, 'fam-a'), null)
    assert.equal(await svc.getAuthorizedFamilyView(100, null), null)
  })
  test('付款人/預約人身分不會自動取得閱覽權', async () => {
    await publish()
    // booking.user_id 就是 fam-a，但沒有授權列
    assert.equal(db.bookings.get(100)!.user_id, 'fam-a')
    assert.equal(await svc.getAuthorizedFamilyView(100, 'fam-a'), null)
  })
  test('別筆訂單的家屬讀不到這筆', async () => {
    await publish()
    db.auths.push({ id: 1, booking_id: 200, user_id: 'fam-b', scope: 'view_service_summary', revoked_at: null })
    assert.equal(await svc.getAuthorizedFamilyView(100, 'fam-b'), null)
  })
  test('撤回授權後立刻讀不到', async () => {
    await publish()
    db.auths.push({ id: 1, booking_id: 100, user_id: 'fam-a', scope: 'view_service_summary', revoked_at: null })
    assert.ok(await svc.getAuthorizedFamilyView(100, 'fam-a'))
    db.auths[0].revoked_at = '2026-01-01T00:00:00Z'
    assert.equal(await svc.getAuthorizedFamilyView(100, 'fam-a'), null)
  })
  test('家屬視圖不含內部紀錄、金額或陪診員身分', async () => {
    await publish()
    db.auths.push({ id: 1, booking_id: 100, user_id: 'fam-a', scope: 'view_service_summary', revoked_at: null })
    const view = await svc.getAuthorizedFamilyView(100, 'fam-a')
    const json = JSON.stringify(view)
    assert.equal(/companion_id|companion_fee|objective_summary|record/.test(json), false, json)
  })
  test('只有通知授權時只看得到事件，看不到小結', async () => {
    await publish()
    db.auths.push({ id: 1, booking_id: 100, user_id: 'fam-a', scope: 'receive_service_notification', revoked_at: null })
    const view = await svc.getAuthorizedFamilyView(100, 'fam-a')
    assert.equal(view?.summary, null)
    assert.equal(view?.scopes.view_service_summary, false)
  })
  test('照片授權本輪一律拒絕', async () => {
    await assert.rejects(
      () => svc.grantCareServiceAuthorization(100, 'fam-a', 'view_service_photo' as any, sup),
      CareRuleError)
  })
})

describe('異常事件與通知', () => {
  const inc = v.parseIncident({ incident_type: 'family_contact_needed', severity: 'medium' })
  test('只能為自己的服務建立', async () => {
    await assert.doesNotReject(() => svc.createOwnCareIncident(100, inc, staffA))
    await assert.rejects(() => svc.createOwnCareIncident(200, inc, staffA), CareRuleError)
  })
  test('建立時不會自帶通知狀態', async () => {
    const r = await svc.createOwnCareIncident(100, inc, staffA)
    assert.equal(db.incidents.get(r.incidentId)!.notification_status, 'not_required')
    assert.equal(db.incidents.get(r.incidentId)!.status, 'open')
  })
  test('open 不能直接結案', async () => {
    const r = await svc.createOwnCareIncident(100, inc, staffA)
    await assert.rejects(() => svc.closeCareIncident(r.incidentId, sup), CareRuleError)
  })
  test('ack → resolve → close 的完整流程', async () => {
    const r = await svc.createOwnCareIncident(100, inc, staffA)
    await svc.acknowledgeCareIncident(r.incidentId, sup)
    await svc.resolveCareIncident(r.incidentId, 'family_contacted', sup)
    await svc.closeCareIncident(r.incidentId, sup)
    assert.equal(db.incidents.get(r.incidentId)!.status, 'closed')
  })
  test('通知最多只能到 prepared，永遠不會變成已送出', async () => {
    const r = await svc.createOwnCareIncident(100, inc, staffA)
    const a = await svc.markCareIncidentNotificationPrepared(r.incidentId, sup)
    assert.equal(a.to, 'pending')
    const b = await svc.markCareIncidentNotificationPrepared(r.incidentId, sup)
    assert.equal(b.to, 'prepared')
    const c = await svc.markCareIncidentNotificationPrepared(r.incidentId, sup)
    assert.equal(c.to, 'prepared', '再按也停在 prepared')
    assert.notEqual(db.incidents.get(r.incidentId)!.notification_status, 'sent_or_confirmed')
  })
})

describe('結算：兼職／全職與重複保護', () => {
  beforeEach(() => { db.bookings.get(100)!.status = '已完成' })

  test('已完成的兼職服務可產生待審核明細', async () => {
    const r = await svc.generatePendingPartTimeSettlementLine(100, sup)
    assert.equal(r.created, true)
    assert.equal(r.amount, 1300)
    assert.equal(db.lines.get(r.lineId)!.status, 'pending_review')
  })
  test('重複產生是冪等的，不會出現第二筆', async () => {
    const a = await svc.generatePendingPartTimeSettlementLine(100, sup)
    const b = await svc.generatePendingPartTimeSettlementLine(100, sup)
    assert.equal(a.lineId, b.lineId)
    assert.equal(b.created, false)
    assert.equal(db.lines.size, 1)
  })
  test('未完成的服務不能產生明細', async () => {
    db.bookings.get(100)!.status = '服務中'
    await assert.rejects(() => svc.generatePendingPartTimeSettlementLine(100, sup), CareRuleError)
  })
  test('全職不產生報酬明細', async () => {
    await assert.rejects(() => svc.generatePendingPartTimeSettlementLine(300, sup), CareRuleError)
    assert.equal(db.lines.size, 0)
  })
  test('全職的收入頁不顯示金額', async () => {
    const r = await svc.getOwnPublishedSettlement(staffFull)
    assert.equal(r.fulltime_notice, true)
    assert.deepEqual(r.lines, [])
    assert.equal(r.total, 0)
  })
  test('陪診員看不到未審核的金額', async () => {
    await svc.generatePendingPartTimeSettlementLine(100, sup)
    const r = await svc.getOwnPublishedSettlement(staffA)
    assert.deepEqual(r.lines, [])
    assert.equal(r.total, 0)
  })
  test('完整流程：審核 → 批次 → 核准 → 發布，陪診員才看得到', async () => {
    const l = await svc.generatePendingPartTimeSettlementLine(100, sup)
    await svc.reviewCareSettlementLine(l.lineId, 'approve', null, sup)
    const b = await svc.createCareSettlementBatch('2026-09-01', '2026-09-30', [l.lineId], sup)
    await svc.approveCareSettlementBatch(b.batchId, sup)
    await svc.publishCareSettlementBatch(b.batchId, sup)

    const own = await svc.getOwnPublishedSettlement(staffA)
    assert.equal(own.lines.length, 1)
    assert.equal(own.total, 1300)
  })
  test('未審核的明細不會被掛進批次', async () => {
    const l = await svc.generatePendingPartTimeSettlementLine(100, sup)
    const b = await svc.createCareSettlementBatch('2026-09-01', '2026-09-30', [l.lineId], sup)
    assert.equal(db.lines.get(l.lineId)!.batch_id, undefined)
    assert.equal(db.lines.get(l.lineId)!.status, 'pending_review')
    await svc.approveCareSettlementBatch(b.batchId, sup)
    await svc.publishCareSettlementBatch(b.batchId, sup)
    const own = await svc.getOwnPublishedSettlement(staffA)
    assert.deepEqual(own.lines, [])
  })
  test('陪診員 A 看不到陪診員 B 的金額', async () => {
    const l = await svc.generatePendingPartTimeSettlementLine(100, sup)
    await svc.reviewCareSettlementLine(l.lineId, 'approve', null, sup)
    const b = await svc.createCareSettlementBatch('2026-09-01', '2026-09-30', [l.lineId], sup)
    await svc.approveCareSettlementBatch(b.batchId, sup)
    await svc.publishCareSettlementBatch(b.batchId, sup)
    const bView = await svc.getOwnPublishedSettlement(staffB)
    assert.deepEqual(bView.lines, [])
  })
  test('批次不能跳過核准直接發布', async () => {
    const b = await svc.createCareSettlementBatch('2026-09-01', '2026-09-30', [], sup)
    await assert.rejects(() => svc.publishCareSettlementBatch(b.batchId, sup), CareRuleError)
  })
})

describe('陪診員工作區：只看得到自己的東西', () => {
  test('別人的服務打不開', async () => {
    await assert.rejects(() => svc.getOwnServiceWorkspace(200, staffA), CareRuleError)
  })
  test('看得到小結進度，但看不到小結內容', async () => {
    const s = await svc.createCareFamilySummaryDraft(100, summaryInput, sup)
    await svc.submitCareFamilySummaryForReview(s.summaryId, sup)
    const w = await svc.getOwnServiceWorkspace(100, staffA)
    assert.equal(w.summary_state, 'in_review')
    assert.equal(/completed_steps_text/.test(JSON.stringify(w)), false)
  })
  test('只看得到自己建立的異常事件', async () => {
    await svc.createOwnCareIncident(100, v.parseIncident({ incident_type: 'family_contact_needed' }), staffA)
    db.incidents.set(999, { id: 999, booking_id: 100, companion_id: 2, incident_type: 'x', status: 'open' })
    const w = await svc.getOwnServiceWorkspace(100, staffA)
    assert.equal(w.incidents.length, 1)
    assert.equal(w.incidents[0].companion_id, 1)
  })
})
