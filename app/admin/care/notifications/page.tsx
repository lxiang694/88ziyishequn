'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  NOTIFICATION_TYPE_LABELS, NOTIFICATION_STATUS_LABELS,
  OUTBOX_STATUS_LABELS, OUTBOX_SUPPRESSION_LABELS, labelOf,
} from '@/lib/care/operations/labels'

interface Item { id: number; notification_type: string; status: string; booking_id: number | null; created_at: string; recipient_kind: string }
interface Outbox { id: number; notification_id: number; channel: string; status: string; suppression_reason_code: string | null; created_at: string }

export default function CareNotificationsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [outbox, setOutbox] = useState<Outbox[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [externalEnabled, setExternalEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/notifications').then(r => r.json())
      .then(d => {
        if (d.success) {
          setItems(d.data.items); setOutbox(d.data.outbox)
          setCounts(d.data.outbox_counts); setExternalEnabled(d.data.external_enabled)
        } else setError(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const suppress = async (id: number) => {
    const res = await fetch('/api/admin/care/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'suppress_outbox', outbox_id: id, reason_code: 'operations_decision' }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success('已抑制'); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🔔 站內通知與 outbox</h1>
      <p className="text-sm text-gray-500 mb-4">
        這裡只看得到通知的 metadata，看不到每一則的內文——內文是收件人的資料。
      </p>

      <div className={`rounded-xl border p-4 mb-5 ${externalEnabled ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
        <p className={`font-bold text-sm mb-1 ${externalEnabled ? 'text-red-800' : 'text-blue-900'}`}>
          {externalEnabled ? '⚠️ 外部通知已啟用' : '📭 外部通知未啟用'}
        </p>
        <p className={`text-sm ${externalEnabled ? 'text-red-700' : 'text-blue-800'}`}>
          {externalEnabled
            ? '偵測到外部通知被打開，但本輪沒有已核准的 provider，請立即確認。'
            : '目前沒有已核准的 LINE／SMS／Email 服務，所有外部 outbox 一律停在「未設定」，系統不會發送任何訊息，也不會標記為已送出。'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {!loading && !error && (
        <>
          <h2 className="font-bold text-gray-800 mb-2">Outbox 狀態</h2>
          {Object.keys(counts).length === 0 ? (
            <div className="bg-white rounded-xl border p-6 text-center text-gray-500 text-sm mb-6">
              目前沒有 outbox 紀錄
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(counts).map(([k, v]) => (
                <span key={k} className="text-sm bg-gray-100 rounded-lg px-3 py-1.5">
                  {labelOf(OUTBOX_STATUS_LABELS, k)}：<strong>{v}</strong>
                </span>
              ))}
            </div>
          )}

          {outbox.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden mb-6">
              {outbox.slice(0, 20).map(o => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">#{o.notification_id}・{o.channel}</p>
                    <p className="text-xs text-gray-500">
                      {labelOf(OUTBOX_STATUS_LABELS, o.status)}
                      {o.suppression_reason_code && `・${labelOf(OUTBOX_SUPPRESSION_LABELS, o.suppression_reason_code)}`}
                    </p>
                  </div>
                  {o.status !== 'suppressed' && o.status !== 'cancelled' && (
                    <button onClick={() => suppress(o.id)}
                      className="text-sm text-gray-600 border rounded-lg px-3 py-1.5 flex-shrink-0">
                      抑制
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 className="font-bold text-gray-800 mb-2">最近的站內通知</h2>
          {items.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">
              目前沒有通知紀錄
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              {items.map(i => (
                <div key={i.id} className="flex items-center justify-between gap-3 p-3 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {labelOf(NOTIFICATION_TYPE_LABELS, i.notification_type)}
                    </p>
                    <p className="text-xs text-gray-500">
                      收件人：{i.recipient_kind === 'family' ? '家屬' : '陪診員'}
                      {i.booking_id && `・服務 #${i.booking_id}`}・{i.created_at.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-100 rounded px-2 py-1 flex-shrink-0">
                    {labelOf(NOTIFICATION_STATUS_LABELS, i.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
