'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { SUMMARY_STATUS_LABELS, WITHDRAW_REASON_LABELS, labelOf, chipClass } from '@/lib/care/fulfilment/labels'

interface Row {
  id: number; booking_id: number; version_number: number; status: string
  service_window_text: string | null; completed_steps_text: string | null
  family_actions_text: string | null; next_arrangement_text: string | null
  handover_status_text: string | null; published_at: string | null; updated_at: string
}

const FILTERS = ['', 'draft', 'in_review', 'published', 'withdrawn']

export default function CareSummariesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('in_review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState<number | null>(null)
  const [reason, setReason] = useState('content_correction_needed')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('status')
    if (q && FILTERS.includes(q)) setStatus(q)
  }, [])

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/summaries' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  const act = async (id: number, body: Record<string, unknown>, msg: string) => {
    const res = await fetch(`/api/admin/care/summaries/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setWithdrawing(null); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">📨 家屬小結</h1>
      <p className="text-gray-600 text-sm mb-4">
        只有這裡發布的內容家屬才看得到。陪診員無法自行發布。發布後不可悄悄修改，需撤回或建立新版本。
      </p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? SUMMARY_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : rows.length === 0 ? (
          <div className="card p-10 text-center text-gray-600">
            <p className="text-lg font-semibold text-gray-800 mb-1">這個狀態目前沒有小結</p>
            <p className="text-[15px]">請到單筆服務詳情頁建立草稿。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.status)}`}>
                    {labelOf(SUMMARY_STATUS_LABELS, r.status)}
                  </span>
                  <Link href={`/admin/care/services/${r.booking_id}`}
                    className="text-green-700 font-semibold text-[15px] underline">服務 #{r.booking_id}</Link>
                  <span className="text-gray-600 text-[13px]">第 {r.version_number} 版</span>
                  {r.published_at && <span className="text-gray-600 text-[13px]">{r.published_at.slice(0, 16).replace('T', ' ')} 發布</span>}
                </div>

                <div className="space-y-1.5 text-[15px]">
                  <p><strong className="text-gray-900">服務時間：</strong><span className="text-gray-700">{r.service_window_text}</span></p>
                  <p><strong className="text-gray-900">已完成流程：</strong><span className="text-gray-700">{r.completed_steps_text}</span></p>
                  {r.family_actions_text && <p><strong className="text-gray-900">需家屬確認：</strong><span className="text-gray-700">{r.family_actions_text}</span></p>}
                  {r.next_arrangement_text && <p><strong className="text-gray-900">下次安排：</strong><span className="text-gray-700">{r.next_arrangement_text}</span></p>}
                  {r.handover_status_text && <p><strong className="text-gray-900">交接狀態：</strong><span className="text-gray-700">{r.handover_status_text}</span></p>}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {r.status === 'draft' && (
                    <button onClick={() => act(r.id, { action: 'submit_for_review' }, '已送審')} className="btn-secondary">送審</button>
                  )}
                  {r.status === 'in_review' && (
                    <button onClick={() => act(r.id, { action: 'publish' }, '已發布給家屬')} className="btn-primary">發布給家屬</button>
                  )}
                  {r.status === 'published' && withdrawing !== r.id && (
                    <button onClick={() => setWithdrawing(r.id)} className="btn-danger">撤回</button>
                  )}
                </div>

                {withdrawing === r.id && (
                  <div className="mt-3 space-y-2">
                    <label className="form-label" htmlFor={`wr-${r.id}`}>撤回原因</label>
                    <select id={`wr-${r.id}`} className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
                      {Object.entries(WITHDRAW_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <p className="text-gray-600 text-[13px]">撤回後家屬立即看不到這份小結。</p>
                    <div className="flex gap-2">
                      <button onClick={() => act(r.id, { action: 'withdraw', reason_code: reason }, '已撤回')}
                        className="btn-danger">確定撤回</button>
                      <button onClick={() => setWithdrawing(null)} className="btn-secondary">取消</button>
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
