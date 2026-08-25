'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  INCIDENT_TYPE_LABELS, INCIDENT_STATUS_LABELS, SEVERITY_LABELS,
  NOTIFICATION_LABELS, RESOLUTION_LABELS, labelOf, chipClass,
} from '@/lib/care/fulfilment/labels'

interface Row {
  id: number; booking_id: number; incident_type: string; severity: string; status: string
  description: string | null; notification_status: string; created_at: string
}

const FILTERS = ['', 'open', 'acknowledged', 'resolved', 'closed']

export default function CareIncidentsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolving, setResolving] = useState<number | null>(null)
  const [code, setCode] = useState('family_contacted')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('status')
    if (q && FILTERS.includes(q)) setStatus(q)
  }, [])

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/incidents' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  const act = async (id: number, body: Record<string, unknown>, msg: string) => {
    const res = await fetch(`/api/admin/care/incidents/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setResolving(null); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">⚠️ 異常事件</h1>

      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4">
        <p className="font-bold text-red-900 text-base mb-1">這不是急救或醫療分級工具</p>
        <p className="text-red-900 text-[15px] leading-relaxed">
          現場緊急狀況請依<strong>院方流程、服務 SOP 與當地緊急處理規範</strong>立即行動。
          這裡的優先級只是營運處理順序，不代表醫療嚴重度，也不能取代即時應變。
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? INCIDENT_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : rows.length === 0 ? <div className="card p-10 text-center text-gray-600">這個狀態目前沒有異常事件</div>
        : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.status)}`}>
                    {labelOf(INCIDENT_STATUS_LABELS, r.status)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.severity)}`}>
                    {labelOf(SEVERITY_LABELS, r.severity)}
                  </span>
                  <Link href={`/admin/care/services/${r.booking_id}`}
                    className="text-green-700 font-semibold text-[15px] underline">服務 #{r.booking_id}</Link>
                  <span className="text-gray-600 text-[13px]">{r.created_at?.slice(0, 16).replace('T', ' ')}</span>
                </div>

                <p className="font-semibold text-gray-900 text-[15px]">
                  {labelOf(INCIDENT_TYPE_LABELS, r.incident_type)}
                </p>
                {r.description && (
                  <p className="text-gray-700 text-[15px] leading-relaxed mt-1 whitespace-pre-wrap">{r.description}</p>
                )}

                <p className="text-gray-600 text-[13px] mt-2">
                  家屬通知：{labelOf(NOTIFICATION_LABELS, r.notification_status)}
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {r.status === 'open' && (
                    <button onClick={() => act(r.id, { action: 'acknowledge' }, '已受理')} className="btn-primary">受理</button>
                  )}
                  {(r.status === 'open' || r.status === 'acknowledged') && resolving !== r.id && (
                    <button onClick={() => setResolving(r.id)} className="btn-secondary">標記處理完成</button>
                  )}
                  {r.status === 'resolved' && (
                    <button onClick={() => act(r.id, { action: 'close' }, '已結案')} className="btn-secondary">結案</button>
                  )}
                  {r.notification_status !== 'prepared' && r.notification_status !== 'sent_or_confirmed' && (
                    <button onClick={() => act(r.id, { action: 'prepare_notification' }, '已更新通知狀態')}
                      className="btn-secondary">推進通知狀態</button>
                  )}
                </div>

                {r.notification_status === 'prepared' && (
                  <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[15px] mt-3">
                    通知內容已備妥。系統<strong>不會自動發送</strong>，請人工以電話或 LINE 聯繫家屬。
                  </p>
                )}

                {resolving === r.id && (
                  <div className="mt-3 space-y-2">
                    <label className="form-label" htmlFor={`rc-${r.id}`}>處理結果</label>
                    <select id={`rc-${r.id}`} className="form-input" value={code} onChange={e => setCode(e.target.value)}>
                      {Object.entries(RESOLUTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => act(r.id, { action: 'resolve', resolution_code: code }, '已標記處理完成')}
                        className="btn-primary">確定</button>
                      <button onClick={() => setResolving(null)} className="btn-secondary">取消</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
