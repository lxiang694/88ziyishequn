'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import {
  LINE_STATUS_LABELS, LINE_TYPE_LABELS, BATCH_STATUS_LABELS, labelOf, chipClass,
} from '@/lib/care/fulfilment/labels'

interface Line {
  id: number; booking_id: number; companion_id: number; batch_id: number | null
  line_type: string; amount: number; basis_snapshot: string; status: string
  employment_type_snapshot: string; created_at: string
}
interface Batch {
  id: number; batch_no: string; period_start: string; period_end: string
  status: string; published_at: string | null
}

const FILTERS = ['', 'pending_review', 'approved', 'batched', 'published_to_staff', 'rejected']

export default function CareSettlementsPage() {
  const [lines, setLines] = useState<Line[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [status, setStatus] = useState('pending_review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [period, setPeriod] = useState({ start: '', end: '' })

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/settlements' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => {
        if (d.success) { setLines(d.data.lines); setBatches(d.data.batches); setPicked([]) }
        else setError(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  const post = async (body: Record<string, unknown>, msg: string) => {
    const res = await fetch('/api/admin/care/settlements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); load()
  }

  const approvedTotal = lines.filter(l => picked.includes(l.id)).reduce((s, l) => s + l.amount, 0)

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">💵 結算明細與批次</h1>

      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4">
        <p className="font-bold text-amber-900 text-base mb-1">這裡不會付款</p>
        <p className="text-amber-900 text-[15px] leading-relaxed">
          系統<strong>沒有串接任何金流</strong>。批次「已發布」只代表陪診員可以看到自己的金額，
          「已關閉」只代表平台內部結算完成 —— 兩者都<strong>不代表銀行已匯款</strong>。
          實際轉帳、薪資、勞健保與稅務都在系統外處理。
        </p>
        <p className="text-amber-900 text-[13px] leading-relaxed mt-2">
          另註：既有的「💰 陪診結算報表」仍是目前實際使用的系統，這裡是可稽核的明細基礎，兩者尚未整併。
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? LINE_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : (
          <>
            {status === 'approved' && picked.length > 0 && (
              <div className="card p-4 mb-3">
                <p className="font-bold text-gray-800 text-base mb-2">
                  建立批次（已選 {picked.length} 筆・{formatPrice(approvedTotal)}）
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="form-label" htmlFor="ps">期間起日</label>
                    <input id="ps" type="date" className="form-input" value={period.start}
                      onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pe">期間迄日</label>
                    <input id="pe" type="date" className="form-input" value={period.end}
                      onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))} />
                  </div>
                </div>
                <button disabled={!period.start || !period.end}
                  onClick={() => post({ action: 'create_batch', period_start: period.start, period_end: period.end, line_ids: picked }, '批次已建立')}
                  className="btn-primary disabled:opacity-40">建立批次</button>
              </div>
            )}

            {lines.length === 0 ? (
              <div className="card p-10 text-center text-gray-600 mb-5">這個狀態目前沒有結算明細</div>
            ) : (
              <div className="space-y-2 mb-6">
                {lines.map(l => (
                  <div key={l.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      {l.status === 'approved' && (
                        <input type="checkbox" className="w-5 h-5 rounded accent-green-700 mt-1"
                          aria-label={`選取明細 ${l.id}`}
                          checked={picked.includes(l.id)}
                          onChange={() => setPicked(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id])} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(l.status)}`}>
                            {labelOf(LINE_STATUS_LABELS, l.status)}
                          </span>
                          <span className="text-gray-600 text-[13px]">
                            {labelOf(LINE_TYPE_LABELS, l.line_type)}・服務 #{l.booking_id}・陪診員 #{l.companion_id}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatPrice(l.amount)}</p>
                        <p className="text-gray-600 text-[13px] mt-0.5">{l.basis_snapshot}</p>

                        {l.status === 'pending_review' && (
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => post({ action: 'review_line', line_id: l.id, decision: 'approve' }, '已核准')}
                              className="btn-primary">核准</button>
                            <button onClick={() => post({ action: 'review_line', line_id: l.id, decision: 'reject' }, '已駁回')}
                              className="btn-secondary">駁回</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="font-bold text-gray-800 text-lg mb-2">批次</h2>
            {batches.length === 0 ? (
              <div className="card p-8 text-center text-gray-600">尚未建立任何批次</div>
            ) : (
              <div className="space-y-2">
                {batches.map(b => (
                  <div key={b.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-800 text-[13px]">{b.batch_no}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(b.status)}`}>
                          {labelOf(BATCH_STATUS_LABELS, b.status)}
                        </span>
                      </div>
                      <p className="text-gray-600 text-[13px] mt-0.5">{b.period_start} ～ {b.period_end}</p>
                    </div>
                    <div className="flex gap-2">
                      {b.status === 'draft' && (
                        <button onClick={() => post({ action: 'approve_batch', batch_id: b.id }, '批次已核准')} className="btn-secondary">核准</button>
                      )}
                      {b.status === 'approved' && (
                        <button onClick={() => post({ action: 'publish_batch', batch_id: b.id }, '已發布給陪診員')} className="btn-primary">發布給陪診員</button>
                      )}
                      {b.status === 'published' && (
                        <button onClick={() => post({ action: 'close_batch', batch_id: b.id }, '批次已關閉')} className="btn-secondary">關閉批次</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  )
}
