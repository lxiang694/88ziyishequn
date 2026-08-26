'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FEEDBACK_STATUS_LABELS, FEEDBACK_SCORE_LABELS,
  CONCERN_CATEGORY_LABELS, CONCERN_STATUS_LABELS, CONCERN_SOURCE_LABELS,
  CONCERN_RESOLUTION_LABELS, labelOf,
} from '@/lib/care/operations/labels'

interface Feedback {
  id: number; booking_id: number; status: string; created_at: string
  score_reassurance: number; score_communication: number; score_process_support: number
  comment: string | null
}
interface Concern {
  id: number; booking_id: number | null; source: string; category: string; status: string
  description: string; due_date: string | null; resolution_code: string | null; created_at: string
}

const RESOLUTIONS = Object.keys(CONCERN_RESOLUTION_LABELS)

export default function CareFeedbackPage() {
  const [tab, setTab] = useState<'feedback' | 'concerns'>('feedback')
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [concerns, setConcerns] = useState<Concern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolving, setResolving] = useState<number | null>(null)
  const [code, setCode] = useState(RESOLUTIONS[0])

  const load = useCallback(() => {
    setLoading(true); setError('')
    Promise.all([
      fetch('/api/admin/care/feedback').then(r => r.json()),
      fetch('/api/admin/care/concerns').then(r => r.json()),
    ]).then(([f, c]) => {
      if (f.success) setFeedback(f.data); else setError(f.error || '載入失敗')
      if (c.success) setConcerns(c.data)
      setLoading(false)
    }).catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const actFeedback = async (body: Record<string, unknown>, msg: string) => {
    const res = await fetch('/api/admin/care/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); load()
  }

  const actConcern = async (id: number, body: Record<string, unknown>, msg: string) => {
    const res = await fetch(`/api/admin/care/concerns/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setResolving(null); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">💬 家屬回饋與意見</h1>
      <p className="text-sm text-gray-500 mb-4">
        回饋不會公開顯示，也不會變成公開評價或人員排行。
      </p>

      <div className="flex gap-2 mb-5">
        {([['feedback', `回饋（${feedback.length}）`], ['concerns', `意見案件（${concerns.length}）`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
              tab === k ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {!loading && tab === 'feedback' && (
        feedback.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
            還沒有任何回饋。家屬要在服務完成、小結發布且有閱覽授權時才會收到邀請。
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map(f => (
              <div key={f.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-gray-800 text-sm">服務 #{f.booking_id}</p>
                  <span className="text-xs bg-gray-100 rounded px-2 py-1">
                    {labelOf(FEEDBACK_STATUS_LABELS, f.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-700 mb-2">
                  <span>{FEEDBACK_SCORE_LABELS.score_reassurance}：{f.score_reassurance}/5</span>
                  <span>{FEEDBACK_SCORE_LABELS.score_communication}：{f.score_communication}/5</span>
                  <span>{FEEDBACK_SCORE_LABELS.score_process_support}：{f.score_process_support}/5</span>
                </div>
                {f.comment && (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-2">{f.comment}</p>
                )}
                <div className="flex gap-2">
                  {f.status === 'submitted' && (
                    <button onClick={() => actFeedback({ action: 'start_review', feedback_id: f.id }, '已開始處理')}
                      className="text-sm border rounded-lg px-3 py-1.5">開始處理</button>
                  )}
                  {f.status !== 'closed' && (
                    <button onClick={() => actFeedback({ action: 'close', feedback_id: f.id }, '已結案')}
                      className="text-sm border rounded-lg px-3 py-1.5">結案</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'concerns' && (
        concerns.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
            目前沒有意見案件
          </div>
        ) : (
          <div className="space-y-3">
            {concerns.map(c => (
              <div key={c.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">
                      {labelOf(CONCERN_CATEGORY_LABELS, c.category)}
                      {c.booking_id && <span className="text-gray-500 font-normal">・服務 #{c.booking_id}</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {labelOf(CONCERN_SOURCE_LABELS, c.source)}・{c.created_at.slice(0, 10)}
                      {c.due_date && `・到期 ${c.due_date}`}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-100 rounded px-2 py-1 flex-shrink-0">
                    {labelOf(CONCERN_STATUS_LABELS, c.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-2">{c.description}</p>

                {c.status === 'open' && (
                  <button onClick={() => actConcern(c.id, { action: 'acknowledge' }, '已受理')}
                    className="text-sm border rounded-lg px-3 py-1.5">受理</button>
                )}
                {(c.status === 'acknowledged' || c.status === 'in_follow_up') && (
                  resolving === c.id ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      <select value={code} onChange={e => setCode(e.target.value)}
                        className="border rounded-lg px-3 py-1.5 text-sm">
                        {RESOLUTIONS.map(r => (
                          <option key={r} value={r}>{CONCERN_RESOLUTION_LABELS[r]}</option>
                        ))}
                      </select>
                      <button onClick={() => actConcern(c.id, { action: 'resolve', resolution_code: code }, '已標記處理完成')}
                        className="text-sm bg-gray-800 text-white rounded-lg px-3 py-1.5">確認</button>
                      <button onClick={() => setResolving(null)}
                        className="text-sm border rounded-lg px-3 py-1.5">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setResolving(c.id)}
                      className="text-sm border rounded-lg px-3 py-1.5">標記已處理</button>
                  )
                )}
                {c.status === 'resolved' && (
                  <div className="flex items-center gap-2">
                    {c.resolution_code && (
                      <span className="text-xs text-gray-600">
                        {labelOf(CONCERN_RESOLUTION_LABELS, c.resolution_code)}
                      </span>
                    )}
                    <button onClick={() => actConcern(c.id, { action: 'close' }, '已結案')}
                      className="text-sm border rounded-lg px-3 py-1.5">結案</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
