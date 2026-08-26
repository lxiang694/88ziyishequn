import { test, describe, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Sprint E Service 測試。
 *
 * repository 用 module mock 換成記憶體版本，所以這裡測的是
 * 真正的 Service 邏輯（授權、狀態機、冪等、並發），不是 mock 的行為。
 */

interface Store {
  notifications: any[]
  preferences: any[]
  outbox: any[]
  feedbackRequests: any[]
  feedback: any[]
  concerns: any[]
  reviews: any[]
  followUps: any[]
  policies: any[]
  acceptances: any[]
  lifecycle: any[]
  bookings: any[]
  authorizations: any[]
  summaries: any[]
}

let db: Store
let seq = 0
const nextId = () => ++seq

function uniqueError(): Error {
  const e: any = new Error('duplicate key value violates unique constraint')
  e.code = '23505'
  return e
}

function reset() {
  seq = 0
  db = {
    notifications: [], preferences: [], outbox: [],
    feedbackRequests: [], feedback: [], concerns: [],
    reviews: [], followUps: [], policies: [], acceptances: [], lifecycle: [],
    bookings: [
      { id: 100, status: '已完成', booking_no: 'B100', user_id: 'payer', companion_id: 7 },
      { id: 200, status: '服務中', booking_no: 'B200', user_id: 'payer', companion_id: 7 },
      { id: 300, status: '已完成', booking_no: 'B300', user_id: 'payer', companion_id: 9 },
    ],
    // family-a 對 100 有小結授權；family-b 只有通知授權；payer 什麼都沒有
    authorizations: [
      { booking_id: 100, user_id: 'family-a', scope: 'view_service_summary', revoked_at: null },
      { booking_id: 100, user_id: 'family-a', scope: 'receive_service_notification', revoked_at: null },
      { booking_id: 100, user_id: 'family-b', scope: 'receive_service_notification', revoked_at: null },
      { booking_id: 300, user_id: 'family-c', scope: 'view_service_summary', revoked_at: null },
    ],
    summaries: [
      { id: 500, booking_id: 100, status: 'published' },
      { id: 600, booking_id: 300, status: 'published' },
    ],
  }
}

mock.module('../../lib/care/operations/repository.ts', {
  namedExports: {
    CareTableMissingError: class CareTableMissingError extends Error {},
    isUniqueViolation: (e: unknown) => !!e && (e as any).code === '23505',

    // ── 通知 ──
    insertNotification: async (row: any) => {
      const r = { ...row, id: nextId(), status: 'unread', created_at: new Date().toISOString(), read_at: null }
      db.notifications.push(r); return r
    },
    getNotification: async (id: number) => db.notifications.find(n => n.id === id) || null,
    listNotificationsForUser: async (uid: string) =>
      db.notifications.filter(n => n.recipient_user_id === uid && n.status !== 'archived'),
    listNotificationsForCompanion: async (cid: number) =>
      db.notifications.filter(n => n.recipient_companion_id === cid && n.status !== 'archived'),
    updateNotificationStatus: async (id: number, status: string) => {
      const n = db.notifications.find(x => x.id === id); if (n) n.status = status
    },
    listNotificationMetadata: async () => db.notifications.map(n => ({
      id: n.id, notification_type: n.notification_type, status: n.status,
      booking_id: n.booking_id, created_at: n.created_at,
      recipient_kind: n.recipient_user_id ? 'family' : 'staff',
    })),

    // ── 偏好 ──
    listPreferencesForUser: async (uid: string) => db.preferences.filter(p => p.user_id === uid),
    listPreferencesForCompanion: async (cid: number) => db.preferences.filter(p => p.companion_id === cid),
    upsertPreference: async (row: any) => {
      const found = db.preferences.find(p =>
        p.category === row.category
        && (row.user_id ? p.user_id === row.user_id : p.companion_id === row.companion_id))
      if (found) found.in_app_enabled = row.in_app_enabled
      else db.preferences.push({
        ...row, id: nextId(), external_channel_opt_in: false, external_channel_state: 'not_configured' })
    },

    // ── outbox ──
    insertOutbox: async (row: any) => {
      const r = { ...row, id: nextId(), created_at: new Date().toISOString() }
      db.outbox.push(r); return r
    },
    listOutbox: async () => db.outbox,
    suppressOutbox: async (id: number, reason: string) => {
      const o = db.outbox.find(x => x.id === id)
      if (o) { o.status = 'suppressed'; o.suppression_reason_code = reason }
    },
    countOutboxByStatus: async () => db.outbox.reduce((acc: any, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1; return acc
    }, {}),

    // ── 回饋 ──
    insertFeedbackRequest: async (row: any) => {
      if (db.feedbackRequests.some(r =>
        r.booking_id === row.booking_id && r.recipient_user_id === row.recipient_user_id)) {
        throw uniqueError()
      }
      const r = { ...row, id: nextId(), status: 'eligible', created_at: new Date().toISOString() }
      db.feedbackRequests.push(r); return r
    },
    getFeedbackRequest: async (id: number) => db.feedbackRequests.find(r => r.id === id) || null,
    findFeedbackRequest: async (b: number, u: string) =>
      db.feedbackRequests.find(r => r.booking_id === b && r.recipient_user_id === u) || null,
    listFeedbackRequestsForUser: async (u: string) =>
      db.feedbackRequests.filter(r => r.recipient_user_id === u && ['eligible', 'presented'].includes(r.status)),
    updateFeedbackRequestStatus: async (id: number, status: string) => {
      const r = db.feedbackRequests.find(x => x.id === id); if (r) r.status = status
    },
    insertFeedback: async (row: any) => {
      if (db.feedback.some(f => f.request_id === row.request_id)) throw uniqueError()
      const r = { ...row, id: nextId(), status: 'submitted', created_at: new Date().toISOString() }
      db.feedback.push(r); return r
    },
    getFeedbackByRequest: async (rid: number) => db.feedback.find(f => f.request_id === rid) || null,
    listFeedback: async () => db.feedback,
    listFeedbackScores: async () => db.feedback.map(f => ({
      score_reassurance: f.score_reassurance,
      score_communication: f.score_communication,
      score_process_support: f.score_process_support,
    })),
    updateFeedbackStatus: async (id: number, status: string) => {
      const f = db.feedback.find(x => x.id === id); if (f) f.status = status
    },

    // ── 意見案件 ──
    insertConcern: async (row: any) => {
      const r = {
        ...row, id: nextId(), status: 'open', owner_admin_id: null, due_date: null,
        resolution_code: null, internal_note: null,
        created_at: new Date().toISOString(), resolved_at: null,
      }
      db.concerns.push(r); return r
    },
    getConcern: async (id: number) => db.concerns.find(c => c.id === id) || null,
    listConcerns: async (status?: string) =>
      status ? db.concerns.filter(c => c.status === status) : db.concerns,
    listConcernsForUser: async (u: string) => db.concerns.filter(c => c.source_user_id === u),
    updateConcern: async (id: number, patch: any) => {
      const c = db.concerns.find(x => x.id === id); if (c) Object.assign(c, patch)
    },
    countOverdueConcerns: async () => 0,

    // ── 品質 ──
    insertQualityReview: async (row: any) => {
      if (db.reviews.some(r => r.booking_id === row.booking_id)) throw uniqueError()
      const r = {
        ...row, id: nextId(), status: 'pending', internal_note: null,
        chk_events_complete: null, chk_record_on_time: null, chk_summary_clear: null,
        chk_authorization_correct: null, chk_communication_done: null,
        created_at: new Date().toISOString(), completed_at: null,
      }
      db.reviews.push(r); return r
    },
    getQualityReview: async (id: number) => db.reviews.find(r => r.id === id) || null,
    findQualityReviewByBooking: async (b: number) => db.reviews.find(r => r.booking_id === b) || null,
    listQualityReviews: async (status?: string) =>
      status ? db.reviews.filter(r => r.status === status) : db.reviews,
    updateQualityReview: async (id: number, patch: any) => {
      const r = db.reviews.find(x => x.id === id); if (r) Object.assign(r, patch)
    },
    insertFollowUp: async (row: any) => {
      const r = { ...row, id: nextId(), status: 'open', created_at: new Date().toISOString() }
      db.followUps.push(r); return r
    },
    getFollowUp: async (id: number) => db.followUps.find(f => f.id === id) || null,
    listFollowUpsForCompanion: async (cid: number) =>
      db.followUps.filter(f => f.owner_companion_id === cid && f.status !== 'cancelled'),
    listFollowUps: async () => db.followUps,
    updateFollowUp: async (id: number, patch: any) => {
      const f = db.followUps.find(x => x.id === id); if (f) Object.assign(f, patch)
    },

    // ── 政策 ──
    listPolicyVersions: async () => db.policies,
    getPolicyVersion: async (id: number) => db.policies.find(p => p.id === id) || null,
    listPublishedPolicyKinds: async () =>
      db.policies.filter(p => p.status === 'published').map(p => p.policy_kind),
    insertPolicyVersion: async (row: any) => {
      const r = { ...row, id: nextId(), status: 'draft', published_at: null, created_at: new Date().toISOString() }
      db.policies.push(r); return r
    },
    retirePublishedPolicy: async (kind: string) => {
      for (const p of db.policies) {
        if (p.policy_kind === kind && p.status === 'published') p.status = 'retired'
      }
    },
    publishPolicyVersion: async (id: number) => {
      const p = db.policies.find(x => x.id === id)
      if (p) { p.status = 'published'; p.published_at = new Date().toISOString() }
    },
    insertPolicyAcceptance: async (row: any) => {
      if (db.acceptances.some(a =>
        a.policy_version_id === row.policy_version_id
        && (row.user_id ? a.user_id === row.user_id : a.companion_id === row.companion_id))) {
        throw uniqueError()
      }
      db.acceptances.push({ ...row, id: nextId(), accepted_at: new Date().toISOString() })
    },
    hasAcceptedPolicy: async (pid: number, uid: string) =>
      db.acceptances.some(a => a.policy_version_id === pid && a.user_id === uid),

    // ── 生命週期 ──
    insertLifecycleReview: async (row: any) => {
      const r = { ...row, id: nextId(), status: 'pending', created_at: new Date().toISOString() }
      db.lifecycle.push(r); return r
    },
    listLifecycleReviews: async () => db.lifecycle,
    updateLifecycleReview: async (id: number, status: string, note: string | null) => {
      const l = db.lifecycle.find(x => x.id === id); if (l) { l.status = status; l.note = note }
    },

    // ── 共用查詢 ──
    listActiveAuthorizations: async (uid: string, bid: number) =>
      db.authorizations.filter(a => a.user_id === uid && a.booking_id === bid && a.revoked_at === null),
    getBookingBasics: async (id: number) => db.bookings.find(b => b.id === id) || null,
    getPublishedSummaryId: async (bid: number) =>
      db.summaries.find(s => s.booking_id === bid && s.status === 'published')?.id ?? null,
    tableExists: async () => true,
    getOperationsQueueCounts: async () => ({
      pending_intakes: 0, pending_dispatch: 0, in_service: 0,
      pending_record_review: 0, pending_summary_publish: 0, open_incidents: 0,
      open_concerns: db.concerns.filter(c => c.status !== 'closed').length,
      open_quality_follow_ups: 0, pending_settlement_lines: 0,
    }),
    countStaffReadinessGaps: async () => ({ withoutEmployment: 0, withoutCapability: 0 }),
    countBroadAccessAdmins: async () => 1,
    getInsightCounts: async () => ({
      intakes_total: 0, cases_total: 0, quotes_confirmed: 0,
      bookings_total: db.bookings.length,
      bookings_completed: db.bookings.filter(b => b.status === '已完成').length,
      proposals_accepted: 0, proposals_declined: 0, summaries_published: db.summaries.length,
      feedback_requests: db.feedbackRequests.length, feedback_submitted: db.feedback.length,
    }),
  },
})

const svc = await import('../../lib/care/operations/service.ts')
const admin = { id: 1, name: '客服小美', account: 'ops' }
const familyA = { userId: 'family-a' }
const familyB = { userId: 'family-b' }
const payer = { userId: 'payer' }
const staff7 = { id: 7, name: '陪診員甲' }
const staff9 = { id: 9, name: '陪診員乙' }

beforeEach(reset)

describe('通知：授權決定收不收得到', () => {
  test('有授權才會建立', async () => {
    const r = await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    assert.ok(r.notificationId)
    assert.equal(r.skipped, null)
  })

  test('沒有授權就不建立（付款人也一樣）', async () => {
    const r = await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'payer' },
    }, admin)
    assert.equal(r.notificationId, null)
    assert.equal(r.skipped, 'authorization_revoked')
  })

  test('授權撤回後不再建立新通知', async () => {
    db.authorizations = db.authorizations.map(a =>
      a.user_id === 'family-a' ? { ...a, revoked_at: '2026-08-01T00:00:00Z' } : a)
    // 記憶體版的 listActiveAuthorizations 會過濾 revoked_at
    db.authorizations = db.authorizations.filter(a => a.revoked_at === null)
    const r = await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    assert.equal(r.notificationId, null)
  })

  test('陪診員類型的通知不能寄給家屬', async () => {
    await assert.rejects(() => svc.createInAppCareNotification({
      type: 'settlement_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin), /不能寄給家屬/)
  })

  test('關掉的類別不再建立，但必要類別仍會建立', async () => {
    await svc.updateOwnCareNotificationPreference(
      { category: 'service_progress', in_app_enabled: false },
      { kind: 'family', userId: 'family-a' })
    await svc.updateOwnCareNotificationPreference(
      { category: 'action_needed', in_app_enabled: false },
      { kind: 'family', userId: 'family-a' })

    const off = await svc.createInAppCareNotification({
      type: 'service_event_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    assert.equal(off.notificationId, null)
    assert.equal(off.skipped, 'user_disabled_category')

    const essential = await svc.createInAppCareNotification({
      type: 'family_action_needed', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    assert.ok(essential.notificationId, '需要確認的事項不該被關掉')
  })

  test('每則通知都會產生一筆 not_configured 的 outbox', async () => {
    await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    assert.equal(db.outbox.length, 1)
    assert.equal(db.outbox[0].status, 'not_configured')
    assert.equal(db.outbox[0].suppression_reason_code, 'no_provider_configured')
  })

  test('outbox 永遠不會出現 sent 或 delivered', async () => {
    for (const t of ['family_summary_published', 'family_action_needed', 'feedback_requested'] as const) {
      await svc.createInAppCareNotification({
        type: t, bookingId: 100, recipient: { kind: 'family', userId: 'family-a' },
      }, admin)
    }
    for (const o of db.outbox) {
      assert.ok(['not_configured', 'suppressed', 'cancelled'].includes(o.status), `出現了 ${o.status}`)
    }
  })
})

describe('通知：只能操作自己的', () => {
  test('別人的通知標為已讀會失敗，且不透露是否存在', async () => {
    const r = await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    await assert.rejects(
      () => svc.markOwnCareNotificationRead(r.notificationId!, { kind: 'family', userId: 'family-b' }),
      /找不到這則通知/)
  })

  test('陪診員不能標記家屬的通知', async () => {
    const r = await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    await assert.rejects(
      () => svc.markOwnCareNotificationRead(r.notificationId!, { kind: 'staff', companionId: 7 }),
      /找不到這則通知/)
  })

  test('陪診員 A 讀不到陪診員 B 的通知', async () => {
    await svc.createInAppCareNotification({
      type: 'staff_schedule_updated', bookingId: null,
      recipient: { kind: 'staff', companionId: 9 },
    }, admin)
    const mine = await svc.listOwnStaffNotifications(staff7)
    assert.equal(mine.length, 0)
    const theirs = await svc.listOwnStaffNotifications(staff9)
    assert.equal(theirs.length, 1)
  })

  test('已讀之後不能再標為已讀（狀態機）', async () => {
    const r = await svc.createInAppCareNotification({
      type: 'family_summary_published', bookingId: 100,
      recipient: { kind: 'family', userId: 'family-a' },
    }, admin)
    await svc.markOwnCareNotificationRead(r.notificationId!, { kind: 'family', userId: 'family-a' })
    await assert.rejects(
      () => svc.markOwnCareNotificationRead(r.notificationId!, { kind: 'family', userId: 'family-a' }))
  })
})

describe('回饋：授權、資格與唯一性', () => {
  test('有小結授權且服務完成才建立得了邀請', async () => {
    const r = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    assert.ok(r.requestId)
    assert.equal(r.created, true)
  })

  test('只有通知授權的人不能收到回饋邀請', async () => {
    await assert.rejects(
      () => svc.createAuthorizedCareFeedbackRequest(100, 'family-b', admin), /授權/)
  })

  test('付款人不會自動 eligible', async () => {
    await assert.rejects(
      () => svc.createAuthorizedCareFeedbackRequest(100, 'payer', admin), /授權/)
  })

  test('服務未完成不能建立邀請', async () => {
    db.authorizations.push(
      { booking_id: 200, user_id: 'family-a', scope: 'view_service_summary', revoked_at: null })
    db.summaries.push({ id: 700, booking_id: 200, status: 'published' })
    await assert.rejects(
      () => svc.createAuthorizedCareFeedbackRequest(200, 'family-a', admin), /尚未完成/)
  })

  test('重複建立是冪等的，不會產生第二張邀請', async () => {
    const a = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    const b = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    assert.equal(a.requestId, b.requestId)
    assert.equal(b.created, false)
    assert.equal(db.feedbackRequests.length, 1)
  })

  test('並發建立也只會有一張', async () => {
    const rs = await Promise.all([
      svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin),
      svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin),
      svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin),
    ])
    assert.equal(db.feedbackRequests.length, 1)
    assert.equal(new Set(rs.map(r => r.requestId)).size, 1)
  })

  const scores = { score_reassurance: 5, score_communication: 4, score_process_support: 5, comment: null }

  test('本人才能送出', async () => {
    const r = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    await assert.rejects(
      () => svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyB),
      /找不到這張回饋邀請/)
  })

  test('一張邀請只收一份回饋', async () => {
    const r = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    const first = await svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyA)
    assert.equal(first.alreadySubmitted, false)
    const second = await svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyA)
    assert.equal(second.alreadySubmitted, true)
    assert.equal(second.feedbackId, first.feedbackId)
    assert.equal(db.feedback.length, 1)
  })

  test('並發送出也只會有一份', async () => {
    const r = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    await Promise.all([
      svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyA),
      svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyA),
      svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyA),
    ])
    assert.equal(db.feedback.length, 1)
  })

  test('送出後授權被撤回，就不能再送', async () => {
    const r = await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    db.authorizations = db.authorizations.filter(a => a.user_id !== 'family-a')
    await assert.rejects(
      () => svc.submitOwnAuthorizedCareFeedback(r.requestId, scores, familyA), /授權/)
  })

  test('家屬看不到別人的回饋邀請', async () => {
    await svc.createAuthorizedCareFeedbackRequest(100, 'family-a', admin)
    assert.equal((await svc.listOwnFeedbackRequests(familyB)).length, 0)
    assert.equal((await svc.listOwnFeedbackRequests(familyA)).length, 1)
  })
})

describe('意見案件：來源人只看得到最小狀態', () => {
  test('家屬要有授權才能提出', async () => {
    await assert.rejects(
      () => svc.createOwnFamilyConcern(100, { category: 'schedule', description: 'x' }, payer),
      /授權/)
    const r = await svc.createOwnFamilyConcern(100, { category: 'schedule', description: 'x' }, familyA)
    assert.ok(r.concernId)
  })

  test('陪診員只能為自己的服務提出', async () => {
    await assert.rejects(
      () => svc.createOwnStaffConcern(300, { category: 'handover', description: 'x' }, staff7),
      /不是您的服務/)
    const r = await svc.createOwnStaffConcern(100, { category: 'handover', description: 'x' }, staff7)
    assert.ok(r.concernId)
  })

  test('提出者看得到狀態，但看不到內部備註與負責人', async () => {
    const c = await svc.createOwnFamilyConcern(100, { category: 'schedule', description: '時間太趕' }, familyA)
    await svc.acknowledgeCareConcern(c.concernId, admin)
    await svc.resolveCareConcern(c.concernId, 'process_adjusted', '已與陪診員檢討排班', admin)

    const view = await svc.listOwnConcernStatuses(familyA)
    assert.equal(view.length, 1)
    const keys = Object.keys(view[0])
    for (const leaked of ['internal_note', 'owner_admin_id', 'description']) {
      assert.equal(keys.includes(leaked), false, `外洩 ${leaked}`)
    }
    assert.equal(view[0].status, 'resolved')
    assert.equal(view[0].resolution_code, 'process_adjusted')
  })

  test('別人看不到我的案件', async () => {
    await svc.createOwnFamilyConcern(100, { category: 'schedule', description: 'x' }, familyA)
    assert.equal((await svc.listOwnConcernStatuses(familyB)).length, 0)
  })

  test('狀態機：open 不能直接結案', async () => {
    const c = await svc.createOwnFamilyConcern(100, { category: 'schedule', description: 'x' }, familyA)
    await assert.rejects(() => svc.closeCareConcern(c.concernId, admin))
    await assert.rejects(() => svc.resolveCareConcern(c.concernId, 'no_action_needed', null, admin))
  })

  test('完整流程：受理 → 處理 → 結案', async () => {
    const c = await svc.createOwnFamilyConcern(100, { category: 'schedule', description: 'x' }, familyA)
    await svc.acknowledgeCareConcern(c.concernId, admin)
    await svc.resolveCareConcern(c.concernId, 'explained_to_family', null, admin)
    await svc.closeCareConcern(c.concernId, admin)
    assert.equal(db.concerns[0].status, 'closed')
    // 結案後不可再受理
    await assert.rejects(() => svc.acknowledgeCareConcern(c.concernId, admin))
  })
})

describe('品質覆核與改善事項', () => {
  test('同一筆服務只會有一份覆核（冪等 + 並發）', async () => {
    const a = await svc.createCareQualityReview(100, admin)
    const b = await svc.createCareQualityReview(100, admin)
    assert.equal(a.reviewId, b.reviewId)
    await Promise.all([
      svc.createCareQualityReview(300, admin),
      svc.createCareQualityReview(300, admin),
    ])
    assert.equal(db.reviews.length, 2)
  })

  test('pending 不能直接完成', async () => {
    const r = await svc.createCareQualityReview(100, admin)
    await assert.rejects(() => svc.completeCareQualityReview(r.reviewId, {
      chk_events_complete: true, chk_record_on_time: null, chk_summary_clear: null,
      chk_authorization_correct: null, chk_communication_done: null,
      internal_note: null, needs_follow_up: false,
    }, admin))
  })

  test('完成後不能退回，只能另建改善事項', async () => {
    const r = await svc.createCareQualityReview(100, admin)
    await svc.startCareQualityReview(r.reviewId, admin)
    await svc.completeCareQualityReview(r.reviewId, {
      chk_events_complete: true, chk_record_on_time: true, chk_summary_clear: true,
      chk_authorization_correct: true, chk_communication_done: true,
      internal_note: null, needs_follow_up: false,
    }, admin)
    assert.equal(db.reviews[0].status, 'completed')
    await assert.rejects(() => svc.startCareQualityReview(r.reviewId, admin))
  })

  test('陪診員只看得到自己的改善事項，且是去識別化摘要', async () => {
    const r = await svc.createCareQualityReview(100, admin)
    await svc.createCareQualityFollowUp(r.reviewId, {
      action_code: 'record_timeliness', staff_visible_note: '請當天送審',
      due_date: null, owner_companion_id: 7,
    }, admin)
    await svc.createCareQualityFollowUp(r.reviewId, {
      action_code: 'handover_process', staff_visible_note: '別人的事',
      due_date: null, owner_companion_id: 9,
    }, admin)

    const mine = await svc.listOwnQualityFollowUps(staff7)
    assert.equal(mine.length, 1)
    assert.equal(mine[0].note, '請當天送審')
    const keys = Object.keys(mine[0])
    for (const leaked of ['review_id', 'owner_admin_id', 'internal_note']) {
      assert.equal(keys.includes(leaked), false, `外洩 ${leaked}`)
    }
  })

  test('指派給陪診員時會發一則站內通知', async () => {
    const r = await svc.createCareQualityReview(100, admin)
    await svc.createCareQualityFollowUp(r.reviewId, {
      action_code: 'record_timeliness', staff_visible_note: null,
      due_date: null, owner_companion_id: 7,
    }, admin)
    const notes = db.notifications.filter(n => n.recipient_companion_id === 7)
    assert.equal(notes.length, 1)
    assert.equal(notes[0].notification_type, 'quality_follow_up_requested')
  })

  test('陪診員不能完成別人的改善事項', async () => {
    const r = await svc.createCareQualityReview(100, admin)
    const f = await svc.createCareQualityFollowUp(r.reviewId, {
      action_code: 'record_timeliness', staff_visible_note: null,
      due_date: null, owner_companion_id: 9,
    }, admin)
    await assert.rejects(
      () => svc.completeCareQualityFollowUp(f.followUpId, staff7, true), /找不到這項改善事項/)
    await assert.doesNotReject(
      () => svc.completeCareQualityFollowUp(f.followUpId, staff9, true))
  })

  test('改善事項要先完成才能覆核通過', async () => {
    const r = await svc.createCareQualityReview(100, admin)
    const f = await svc.createCareQualityFollowUp(r.reviewId, {
      action_code: 'record_timeliness', staff_visible_note: null,
      due_date: null, owner_companion_id: 7,
    }, admin)
    await assert.rejects(() => svc.verifyCareQualityFollowUp(f.followUpId, admin))
    await svc.completeCareQualityFollowUp(f.followUpId, staff7, true)
    await svc.verifyCareQualityFollowUp(f.followUpId, admin)
    assert.equal(db.followUps[0].status, 'verified')
  })
})

describe('政策版本與接受紀錄', () => {
  test('正文是空的不可發布', async () => {
    db.policies.push({ id: 900, policy_kind: 'privacy_notice', version_label: 'v1', status: 'draft', body_text: null })
    await assert.rejects(() => svc.publishCarePolicyVersion(900, admin), /正文是空的/)
    db.policies.push({ id: 901, policy_kind: 'terms_of_service', version_label: 'v1', status: 'draft', body_text: '   ' })
    await assert.rejects(() => svc.publishCarePolicyVersion(901, admin), /正文是空的/)
  })

  test('發布新版時舊版自動停用，同種文件只有一個已發布', async () => {
    const a = await svc.createCarePolicyVersionDraft(
      { policy_kind: 'privacy_notice', version_label: 'v1', body_text: '第一版' }, admin)
    await svc.publishCarePolicyVersion(a.policyVersionId, admin)
    const b = await svc.createCarePolicyVersionDraft(
      { policy_kind: 'privacy_notice', version_label: 'v2', body_text: '第二版' }, admin)
    await svc.publishCarePolicyVersion(b.policyVersionId, admin)

    const published = db.policies.filter(p => p.policy_kind === 'privacy_notice' && p.status === 'published')
    assert.equal(published.length, 1)
    assert.equal(published[0].version_label, 'v2')
  })

  test('只能接受已發布的版本', async () => {
    const a = await svc.createCarePolicyVersionDraft(
      { policy_kind: 'privacy_notice', version_label: 'v1', body_text: 'x' }, admin)
    await assert.rejects(
      () => svc.acceptCarePolicyVersion(a.policyVersionId, { kind: 'family', userId: 'family-a' }, null),
      /已發布/)
  })

  test('接受政策不會產生服務授權、consent 或外部 opt-in', async () => {
    const a = await svc.createCarePolicyVersionDraft(
      { policy_kind: 'terms_of_service', version_label: 'v1', body_text: 'x' }, admin)
    await svc.publishCarePolicyVersion(a.policyVersionId, admin)

    const before = db.authorizations.length
    await svc.acceptCarePolicyVersion(a.policyVersionId, { kind: 'family', userId: 'brand-new' }, null)

    // 授權表完全沒動
    assert.equal(db.authorizations.length, before)
    assert.equal(db.authorizations.some(x => x.user_id === 'brand-new'), false)
    // 偏好表也沒有被自動開啟外部通道
    assert.equal(db.preferences.some(p => p.external_channel_opt_in === true), false)
    // 而且這個人依然讀不到任何東西
    assert.equal((await svc.listOwnFamilyNotifications({ userId: 'brand-new' })).length, 0)
  })

  test('重複接受不算錯，也不會產生第二筆', async () => {
    const a = await svc.createCarePolicyVersionDraft(
      { policy_kind: 'terms_of_service', version_label: 'v1', body_text: 'x' }, admin)
    await svc.publishCarePolicyVersion(a.policyVersionId, admin)
    const first = await svc.acceptCarePolicyVersion(
      a.policyVersionId, { kind: 'family', userId: 'family-a' }, null)
    const second = await svc.acceptCarePolicyVersion(
      a.policyVersionId, { kind: 'family', userId: 'family-a' }, null)
    assert.equal(first.accepted, true)
    assert.equal(second.accepted, false)
    assert.equal(db.acceptances.length, 1)
  })
})

describe('指標：只從真實資料算', () => {
  test('沒有回饋時分數是 suppressed，不是 0 也不是 NaN', async () => {
    const d = await svc.getCareInsights()
    assert.equal(d.scores.reassurance.suppressed, true)
    assert.equal(d.scores.reassurance.value, null)
  })

  test('樣本不足仍然 suppressed', async () => {
    for (let i = 0; i < 3; i++) {
      db.feedback.push({
        id: nextId(), score_reassurance: 5, score_communication: 5, score_process_support: 5 })
    }
    const d = await svc.getCareInsights()
    assert.equal(d.scores.reassurance.suppressed, true)
    assert.equal(d.scores.reassurance.sample, 3)
  })

  test('達到門檻才給平均值', async () => {
    for (let i = 0; i < 5; i++) {
      db.feedback.push({
        id: nextId(), score_reassurance: 4, score_communication: 4, score_process_support: 4 })
    }
    const d = await svc.getCareInsights()
    assert.equal(d.scores.reassurance.suppressed, false)
    assert.equal(d.scores.reassurance.value, 4)
  })

  test('回饋完成率沒有邀請時是 null，不是 0%', async () => {
    const d = await svc.getCareInsights()
    assert.equal(d.feedback_completion_rate, null)
  })

  test('指標裡沒有任何個別陪診員的評分欄位', async () => {
    const d = await svc.getCareInsights()
    const json = JSON.stringify(d)
    for (const banned of ['companion_id', 'staff_rank', 'staff_score', 'ranking']) {
      assert.equal(json.includes(banned), false, `出現了 ${banned}`)
    }
  })
})

describe('上線檢核', () => {
  test('條款未發布時整體是 blocked', async () => {
    const r = await svc.getCareReleaseReadiness()
    assert.equal(r.summary.overall, 'blocked')
    const policy = r.checks.filter(c => c.key.startsWith('policy_'))
    assert.ok(policy.every(c => c.state === 'blocked'))
  })

  test('監控未設定時不會顯示 ready', async () => {
    const r = await svc.getCareReleaseReadiness()
    assert.equal(r.checks.find(c => c.key === 'monitoring')!.state, 'blocked')
  })

  test('外部通知那一項是 ready（因為確實關閉）', async () => {
    const r = await svc.getCareReleaseReadiness()
    assert.equal(r.checks.find(c => c.key === 'flag_external_notification')!.state, 'ready')
  })

  test('人工待決項目一律 blocked', async () => {
    const r = await svc.getCareReleaseReadiness()
    assert.ok(r.summary.manualBlocked >= 6)
  })
})

describe('資料生命週期不刪除任何東西', () => {
  test('標記已檢視不會動到任何服務資料', async () => {
    const before = JSON.stringify({
      f: db.feedback, c: db.concerns, n: db.notifications, b: db.bookings })
    const r = await svc.createCareDataLifecycleReview({
      resource_kind: 'feedback', booking_id: null,
      reason_code: 'retention_period_review', due_date: null, note: null,
    }, admin)
    await svc.markCareDataLifecycleReviewed(r.reviewId, 'reviewed', null, admin)

    const after = JSON.stringify({
      f: db.feedback, c: db.concerns, n: db.notifications, b: db.bookings })
    assert.equal(before, after, '生命週期操作動到了實際資料')
    assert.equal(db.lifecycle[0].status, 'reviewed')
  })
})
