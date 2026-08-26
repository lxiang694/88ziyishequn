'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  NOTIFICATION_TYPE_LABELS, NOTIFICATION_CATEGORY_LABELS,
  CONCERN_CATEGORY_LABELS, CONCERN_STATUS_LABELS,
  CONCERN_RESOLUTION_LABELS, FEEDBACK_SCORE_LABELS, labelOf,
} from '@/lib/care/operations/labels'

interface Notif {
  id: number; type: string; status: string
  title: string; body: string | null; link_path: string | null; created_at: string
}
interface Pref { category: string; in_app_enabled: boolean }
interface FeedbackReq { request_id: number; booking_id: number; status: string; expires_at: string | null }
interface ConcernStatus {
  concern_id: number; category: string; status: string
  created_at: string; resolved_at: string | null; resolution_code: string | null
}

const CONCERN_CATS = Object.keys(CONCERN_CATEGORY_LABELS)
const SCORES = ['score_reassurance', 'score_communication', 'score_process_support'] as const

/**
 * 家屬端的通知、回饋與意見面板。
 *
 * 每一個 API 都會再驗一次單筆授權——這個元件顯示什麼，
 * 不取決於它拿到什麼 props，而是取決於伺服器願意回什麼。
 */
export default function FamilyClosurePanel({ bookingId }: { bookingId: number }) {
  const [token, setToken] = useState<string | null>(null)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [reqs, setReqs] = useState<FeedbackReq[]>([])
  const [concerns, setConcerns] = useState<ConcernStatus[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // 回饋表單
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  // 意見表單
  const [showConcern, setShowConcern] = useState(false)
  const [cat, setCat] = useState(CONCERN_CATS[0])
  const [desc, setDesc] = useState('')

  const authed = useCallback(async (url: string, init?: RequestInit) => {
    const t = token || (await supabase.auth.getSession()).data.session?.access_token || null
    if (!t) return null
    if (!token) setToken(t)
    return fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${t}` } })
  }, [token])

  const load = useCallback(async () => {
    setErr('')
    try {
      const [n, f, c] = await Promise.all([
        authed('/api/care/notifications'),
        authed('/api/care/feedback'),
        authed('/api/care/concerns'),
      ])
      if (n) { const d = await n.json(); if (d.success) { setNotifs(d.data.items); setPrefs(d.data.preferences) } }
      if (f) { const d = await f.json(); if (d.success) setReqs(d.data) }
      if (c) { const d = await c.json(); if (d.success) setConcerns(d.data) }
    } catch { setErr('載入失敗，請稍後再試') }
  }, [authed])

  useEffect(() => { load() }, [load])

  const markRead = async (id: number) => {
    const r = await authed(`/api/care/notifications/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    })
    if (r) load()
  }

  const setPref = async (category: string, enabled: boolean) => {
    const r = await authed('/api/care/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_preference', category, in_app_enabled: enabled }),
    })
    if (r) load()
  }

  const submitFeedback = async (requestId: number) => {
    setErr(''); setMsg('')
    const r = await authed(`/api/care/feedback/${requestId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit',
        score_reassurance: scores.score_reassurance || 0,
        score_communication: scores.score_communication || 0,
        score_process_support: scores.score_process_support || 0,
        comment: comment || undefined,
      }),
    })
    if (!r) return
    const d = await r.json()
    if (!d.success) return setErr(d.error || '送出失敗')
    setMsg('謝謝您的回饋，我們收到了。'); setScores({}); setComment(''); load()
  }

  const submitConcern = async () => {
    setErr(''); setMsg('')
    const r = await authed('/api/care/concerns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', booking_id: bookingId, category: cat, description: desc }),
    })
    if (!r) return
    const d = await r.json()
    if (!d.success) return setErr(d.error || '送出失敗')
    setMsg('已收到您的意見，客服會與您聯繫。'); setDesc(''); setShowConcern(false); load()
  }

  const unread = notifs.filter(n => n.status === 'unread')
  const pending = reqs.filter(r => r.booking_id === bookingId && r.status !== 'completed')

  return (
    <div className="space-y-5">
      {err && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800 text-[15px]">{err}</p>
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-emerald-800 text-[15px]">{msg}</p>
        </div>
      )}

      {/* 通知 */}
      {notifs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold text-slate-900 mb-1">通知（未讀 {unread.length}）</h2>
          <p className="text-slate-600 text-[13px] mb-3">
            目前只有站內通知。我們不會傳 LINE 或簡訊給您——外部通知還沒有開通。
          </p>
          <div className="space-y-2">
            {notifs.slice(0, 10).map(n => (
              <div key={n.id}
                className={`rounded-xl border p-3 ${
                  n.status === 'unread' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-[15px]">{n.title}</p>
                    {n.body && <p className="text-slate-700 text-[14px] mt-0.5">{n.body}</p>}
                    <p className="text-slate-500 text-[12px] mt-1">
                      {labelOf(NOTIFICATION_TYPE_LABELS, n.type)}・{n.created_at.slice(0, 10)}
                    </p>
                  </div>
                  {n.status === 'unread' && (
                    <button onClick={() => markRead(n.id)}
                      className="text-emerald-700 font-semibold text-[14px] min-h-[44px] px-2 flex-shrink-0">
                      已讀
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {prefs.length > 0 && (
            <details className="mt-4">
              <summary className="text-slate-700 text-[14px] font-semibold cursor-pointer min-h-[44px] flex items-center">
                通知設定
              </summary>
              <div className="mt-2 space-y-1">
                {prefs.map(p => (
                  <div key={p.category} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-slate-700 text-[14px]">
                      {labelOf(NOTIFICATION_CATEGORY_LABELS, p.category)}
                    </span>
                    <button onClick={() => setPref(p.category, !p.in_app_enabled)}
                      className={`min-h-[44px] px-4 rounded-lg text-[14px] font-semibold border ${
                        p.in_app_enabled
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-600 border-slate-300'}`}>
                      {p.in_app_enabled ? '開' : '關'}
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* 回饋 */}
      {pending.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold text-slate-900 mb-1">想聽聽您的意見</h2>
          <p className="text-slate-600 text-[13px] mb-4">
            這份回饋只有我們內部看得到，不會公開，也不會變成網站上的評價。
            <strong>請不要填寫病況、用藥、身分證字號或電話</strong>——這裡不需要這些資訊。
          </p>
          {SCORES.map(k => (
            <div key={k} className="mb-3">
              <p className="text-slate-800 text-[15px] font-semibold mb-1.5">{FEEDBACK_SCORE_LABELS[k]}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => setScores(s => ({ ...s, [k]: v }))}
                    className={`min-h-[48px] w-12 rounded-xl border-2 font-bold ${
                      scores[k] === v
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-600 border-slate-200'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="想補充的話（最多 300 字，可不填）"
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[15px] mb-3" rows={3} />
          <button onClick={() => submitFeedback(pending[0].request_id)}
            className="w-full min-h-[48px] rounded-xl bg-emerald-700 text-white font-bold">
            送出回饋
          </button>
        </div>
      )}

      {/* 意見／申訴 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="font-bold text-slate-900 mb-1">有需要調整的地方嗎</h2>
        <p className="text-slate-600 text-[13px] mb-3">
          時間安排、溝通、交接上的問題都可以提出，客服會跟進處理。
          若是與病情、檢查或用藥有關的問題，請直接向醫療人員確認——這裡無法協助判斷。
        </p>

        {concerns.length > 0 && (
          <div className="space-y-2 mb-4">
            {concerns.map(c => (
              <div key={c.concern_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-800 text-[14px] font-semibold">
                    {labelOf(CONCERN_CATEGORY_LABELS, c.category)}
                  </span>
                  <span className="text-[12px] bg-white border border-slate-200 rounded px-2 py-1 flex-shrink-0">
                    {labelOf(CONCERN_STATUS_LABELS, c.status)}
                  </span>
                </div>
                <p className="text-slate-500 text-[12px] mt-1">
                  {c.created_at.slice(0, 10)} 提出
                  {c.resolution_code && `・${labelOf(CONCERN_RESOLUTION_LABELS, c.resolution_code)}`}
                </p>
              </div>
            ))}
          </div>
        )}

        {showConcern ? (
          <div className="space-y-2">
            <select value={cat} onChange={e => setCat(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-[15px]">
              {CONCERN_CATS.map(c => (
                <option key={c} value={c}>{CONCERN_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="請描述發生了什麼（最多 500 字，不需要填病況或個資）"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[15px]" rows={4} />
            <div className="flex gap-2">
              <button onClick={submitConcern}
                className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 text-white font-bold">送出</button>
              <button onClick={() => setShowConcern(false)}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 text-slate-700 font-semibold">
                取消
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowConcern(true)}
            className="w-full min-h-[48px] rounded-xl border-2 border-emerald-700 text-emerald-800 font-bold">
            提出意見
          </button>
        )}
      </div>
    </div>
  )
}
