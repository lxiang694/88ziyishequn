'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  QUALITY_REVIEW_STATUS_LABELS, QUALITY_CHECKLIST_LABELS,
  FOLLOW_UP_ACTION_LABELS, FOLLOW_UP_STATUS_LABELS, labelOf,
} from '@/lib/care/operations/labels'

interface Review {
  id: number; booking_id: number; status: string; created_at: string
  chk_events_complete: boolean | null; chk_record_on_time: boolean | null
  chk_summary_clear: boolean | null; chk_authorization_correct: boolean | null
  chk_communication_done: boolean | null; internal_note: string | null
}
interface FollowUp {
  id: number; review_id: number; action_code: string; status: string
  staff_visible_note: string | null; due_date: string | null; owner_companion_id: number | null
}

const CHECKS = Object.keys(QUALITY_CHECKLIST_LABELS)
const ACTIONS = Object.keys(FOLLOW_UP_ACTION_LABELS)

export default function CareQualityPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [marks, setMarks] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [needsFollowUp, setNeedsFollowUp] = useState(false)
  const [addingFu, setAddingFu] = useState<number | null>(null)
  const [fuAction, setFuAction] = useState(ACTIONS[0])
  const [fuNote, setFuNote] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/quality').then(r => r.json())
      .then(d => {
        if (d.success) { setReviews(d.data.reviews); setFollowUps(d.data.follow_ups) }
        else setError(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (url: string, body: Record<string, unknown>, msg: string) => {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setEditing(null); setAddingFu(null); setMarks({}); setNote(''); setFuNote(''); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🔍 服務品質覆核</h1>
      <p className="text-sm text-gray-500 mb-4">
        這是內部流程覆核，不是公開評分，也不會自動產生人事處分或排班限制。
      </p>

      <div className="bg-white rounded-xl border p-4 mb-5">
        <p className="font-semibold text-gray-800 text-sm mb-2">為某筆服務建立覆核</p>
        <div className="flex gap-2">
          <input value={bookingId} onChange={e => setBookingId(e.target.value)}
            placeholder="服務編號（care_bookings.id）"
            className="border rounded-lg px-3 py-2 text-sm flex-1" />
          <button
            onClick={() => bookingId && post('/api/admin/care/quality',
              { action: 'create_review', booking_id: Number(bookingId) }, '已建立')}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-semibold">
            建立
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {!loading && !error && reviews.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
          還沒有任何品質覆核
        </div>
      )}

      <div className="space-y-3">
        {reviews.map(r => {
          const fus = followUps.filter(f => f.review_id === r.id)
          return (
            <div key={r.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-semibold text-gray-800 text-sm">服務 #{r.booking_id}</p>
                <span className="text-xs bg-gray-100 rounded px-2 py-1">
                  {labelOf(QUALITY_REVIEW_STATUS_LABELS, r.status)}
                </span>
              </div>

              {r.status === 'completed' || r.status === 'follow_up_required' ? (
                <div className="flex flex-wrap gap-2 text-xs mb-2">
                  {CHECKS.map(c => {
                    const v = (r as any)[c]
                    return (
                      <span key={c} className={`rounded px-2 py-1 ${
                        v === true ? 'bg-emerald-50 text-emerald-800'
                        : v === false ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-500'}`}>
                        {v === true ? '✓' : v === false ? '✗' : '—'} {QUALITY_CHECKLIST_LABELS[c]}
                      </span>
                    )
                  })}
                </div>
              ) : null}

              {r.internal_note && (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-2">{r.internal_note}</p>
              )}

              {r.status === 'pending' && (
                <button onClick={() => post(`/api/admin/care/quality/${r.id}`, { action: 'start' }, '已開始覆核')}
                  className="text-sm border rounded-lg px-3 py-1.5">開始覆核</button>
              )}

              {r.status === 'in_review' && (
                editing === r.id ? (
                  <div className="border-t pt-3 mt-2 space-y-2">
                    {CHECKS.map(c => (
                      <label key={c} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={marks[c] || false}
                          onChange={e => setMarks(m => ({ ...m, [c]: e.target.checked }))} />
                        {QUALITY_CHECKLIST_LABELS[c]}
                      </label>
                    ))}
                    <textarea value={note} onChange={e => setNote(e.target.value)}
                      placeholder="內部備註（最多 500 字，不要填病況或個資）"
                      className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={needsFollowUp}
                        onChange={e => setNeedsFollowUp(e.target.checked)} />
                      需要改善追蹤
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => post(`/api/admin/care/quality/${r.id}`,
                          { action: 'complete', ...marks, internal_note: note || undefined, needs_follow_up: needsFollowUp },
                          '已完成覆核')}
                        className="text-sm bg-gray-800 text-white rounded-lg px-3 py-1.5">送出</button>
                      <button onClick={() => setEditing(null)}
                        className="text-sm border rounded-lg px-3 py-1.5">取消</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(r.id); setMarks({}); setNote(''); setNeedsFollowUp(false) }}
                    className="text-sm border rounded-lg px-3 py-1.5">填寫覆核</button>
                )
              )}

              {fus.length > 0 && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">改善事項</p>
                  {fus.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-gray-700">
                        {labelOf(FOLLOW_UP_ACTION_LABELS, f.action_code)}
                        {f.due_date && <span className="text-gray-500">・{f.due_date}</span>}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs bg-gray-100 rounded px-2 py-1">
                          {labelOf(FOLLOW_UP_STATUS_LABELS, f.status)}
                        </span>
                        {f.status === 'completed' && (
                          <button onClick={() => post(`/api/admin/care/quality/${f.id}`, { action: 'verify_follow_up' }, '已覆核')}
                            className="text-xs border rounded px-2 py-1">覆核通過</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(r.status === 'in_review' || r.status === 'follow_up_required') && (
                addingFu === r.id ? (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <select value={fuAction} onChange={e => setFuAction(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm w-full">
                      {ACTIONS.map(a => <option key={a} value={a}>{FOLLOW_UP_ACTION_LABELS[a]}</option>)}
                    </select>
                    <input value={fuNote} onChange={e => setFuNote(e.target.value)}
                      placeholder="給陪診員的說明（最多 200 字，這段他看得到）"
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button
                        onClick={() => post(`/api/admin/care/quality/${r.id}`,
                          { action: 'create_follow_up', action_code: fuAction, staff_visible_note: fuNote || undefined },
                          '已建立改善事項')}
                        className="text-sm bg-gray-800 text-white rounded-lg px-3 py-1.5">建立</button>
                      <button onClick={() => setAddingFu(null)}
                        className="text-sm border rounded-lg px-3 py-1.5">取消</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingFu(r.id)}
                    className="text-sm border rounded-lg px-3 py-1.5 mt-2">新增改善事項</button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
