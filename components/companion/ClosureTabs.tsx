'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  NOTIFICATION_TYPE_LABELS, NOTIFICATION_CATEGORY_LABELS,
  FOLLOW_UP_ACTION_LABELS, FOLLOW_UP_STATUS_LABELS, labelOf,
} from '@/lib/care/operations/labels'

interface Notif {
  id: number; type: string; status: string
  title: string; body: string | null; link_path: string | null; created_at: string
}
interface Pref { category: string; in_app_enabled: boolean; external_channel_state: string }
interface FollowUp {
  follow_up_id: number; action_code: string; note: string | null
  due_date: string | null; status: string
}

/** 陪診員的站內通知 */
export function StaffNotificationsTab() {
  const [items, setItems] = useState<Notif[]>([])
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/companion/notifications').then(r => r.json())
      .then(d => {
        if (d.success) { setItems(d.data.items); setPrefs(d.data.preferences) }
        else setError(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (id: number, action: string) => {
    const res = await fetch(`/api/companion/notifications/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    load()
  }

  const setPref = async (category: string, enabled: boolean) => {
    const res = await fetch('/api/companion/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_preference', category, in_app_enabled: enabled }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '設定失敗')
    toast.success('已更新'); load()
  }

  const unread = items.filter(i => i.status === 'unread')

  return (
    <>
      <h2 className="t-section-title mb-1">通知（未讀 {unread.length}）</h2>
      <p className="t-meta mb-4">
        目前只有站內通知。系統不會傳 LINE 或簡訊給您——沒有接上外部服務，也不會假裝已送出。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="t-body text-red-800">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">載入中…</div>}

      {!loading && !error && (
        items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body mb-6">
            目前沒有通知
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {items.map(n => (
              <div key={n.id}
                className={`rounded-2xl border p-4 ${
                  n.status === 'unread' ? 'bg-white border-green-300' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-[15px]">{n.title}</p>
                    {n.body && <p className="t-body mt-0.5">{n.body}</p>}
                    <p className="t-meta mt-1">
                      {labelOf(NOTIFICATION_TYPE_LABELS, n.type)}・{n.created_at.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                  {n.status === 'unread' && (
                    <button onClick={() => act(n.id, 'mark_read')}
                      className="text-green-700 font-semibold text-[15px] min-h-[48px] px-2 flex-shrink-0">
                      已讀
                    </button>
                  )}
                </div>
                {n.link_path && (
                  <a href={n.link_path}
                    className="inline-block mt-2 text-green-700 font-bold text-[15px] underline min-h-[48px]">
                    前往查看
                  </a>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {prefs.length > 0 && (
        <>
          <h2 className="t-section-title mb-3">通知設定</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {prefs.map(p => (
              <div key={p.category}
                className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 last:border-0">
                <p className="t-body">{labelOf(NOTIFICATION_CATEGORY_LABELS, p.category)}</p>
                <button onClick={() => setPref(p.category, !p.in_app_enabled)}
                  className={`min-h-[48px] px-4 rounded-xl font-semibold text-[15px] border-2 ${
                    p.in_app_enabled ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {p.in_app_enabled ? '開' : '關'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** 陪診員的流程改善事項：只有自己的，且不含督導備註與家屬原文 */
export function StaffFollowUpsTab() {
  const [rows, setRows] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/companion/follow-ups').then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const complete = async (id: number) => {
    const res = await fetch(`/api/companion/follow-ups/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success('已回報完成'); load()
  }

  return (
    <>
      <h2 className="t-section-title mb-1">流程改善事項</h2>
      <p className="t-meta mb-4">
        這些是流程上可以調整的地方，不是懲處，也不會影響您的派工資格。
        完成後回報，督導會再確認一次。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="t-body text-red-800">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">載入中…</div>}

      {!loading && !error && (
        rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">
            目前沒有待處理的改善事項
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(f => (
              <div key={f.follow_up_id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-bold text-gray-900 text-base">
                    {labelOf(FOLLOW_UP_ACTION_LABELS, f.action_code)}
                  </p>
                  <span className="status-badge bg-gray-100 text-gray-700 flex-shrink-0">
                    {labelOf(FOLLOW_UP_STATUS_LABELS, f.status)}
                  </span>
                </div>
                {f.note && <p className="t-body mb-2">{f.note}</p>}
                {f.due_date && <p className="t-meta mb-3">請於 {f.due_date} 前完成</p>}
                {(f.status === 'open' || f.status === 'in_progress') && (
                  <button onClick={() => complete(f.follow_up_id)}
                    className="w-full bg-green-700 text-white font-bold rounded-xl min-h-[48px]">
                    回報已完成
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </>
  )
}
