'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PROPOSAL_STATUS_LABELS, DECLINE_LABELS, labelOf, chipClass } from '@/lib/care/staffing/labels'

interface Row {
  id: number; booking_id: number; companion_id: number; status: string
  expires_at: string; responded_at: string | null
  decline_reason_code: string | null; created_at: string
}

const FILTERS = ['', 'proposed', 'accepted', 'declined', 'expired', 'cancelled']

export default function CareProposalsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('proposed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/dispatch/proposals' + (status ? `?status=${status}` : ''))
      .then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [status])
  useEffect(() => { load() }, [load])

  const act = async (id: number, action: string, msg: string) => {
    const res = await fetch(`/api/admin/care/dispatch/proposals/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">✉️ 兼職邀請</h1>
      <p className="text-gray-600 text-sm mb-4">
        邀請<strong>不是</strong>正式指派。陪診員接受後才會設定服務的陪診員；
        有人接受時，同一筆服務的其他邀請會自動撤回。
      </p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTERS.map(f => (
          <button key={f || 'all'} onClick={() => setStatus(f)}
            className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${status === f ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {f ? PROPOSAL_STATUS_LABELS[f] : '全部'}
          </button>
        ))}
      </div>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? <div className="card p-8 text-center text-red-600 font-bold">⚠️ {error}</div>
        : rows.length === 0 ? <div className="card p-10 text-center text-gray-600">這個狀態目前沒有邀請</div>
        : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.status)}`}>
                    {labelOf(PROPOSAL_STATUS_LABELS, r.status)}
                  </span>
                  <Link href={`/admin/care/staff/${r.companion_id}`}
                    className="text-green-700 font-semibold text-[15px] underline">陪診員 #{r.companion_id}</Link>
                  <span className="text-gray-600 text-[13px]">服務 #{r.booking_id}</span>
                </div>
                <p className="text-gray-600 text-sm">
                  到期：{r.expires_at?.slice(0, 16).replace('T', ' ')}
                  {r.responded_at && `｜回覆於 ${r.responded_at.slice(0, 16).replace('T', ' ')}`}
                </p>
                {r.decline_reason_code && (
                  <p className="text-gray-700 text-[15px] mt-1">
                    婉拒原因：{labelOf(DECLINE_LABELS, r.decline_reason_code)}
                  </p>
                )}
                {r.status === 'proposed' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => act(r.id, 'cancel', '已撤回邀請')} className="btn-secondary">撤回</button>
                    <button onClick={() => act(r.id, 'expire', '已標記為逾時')} className="btn-secondary">標記逾時</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
