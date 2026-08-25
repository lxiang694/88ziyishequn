'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import {
  CASE_STATUS_LABELS, QUOTE_STATUS_LABELS, SCENARIO_LABELS,
  CASE_CANCEL_REASON_LABELS, labelFor, statusChipClass,
} from '@/lib/care/labels'

interface CaseRow {
  id: number; case_no: string; status: string; intake_id: number
  cancel_reason_code: string | null; payment_marked_by: string | null
  payment_marked_at: string | null; created_at: string
}
interface QuoteRow {
  id: number; version: number; status: string; service_name_snapshot: string
  total_estimate: number; valid_until: string
}
interface IntakeRow {
  id: number; service_scenario: string; hospital_name: string; county: string
  scheduled_service_date: string; contact_name: string; contact_phone: string
}

export default function CareCaseDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<{ case: CaseRow; intake: IntakeRow | null; quotes: QuoteRow[] } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('family_cancelled')

  const load = useCallback(() => {
    fetch(`/api/admin/care/cases/${params.id}`)
      .then(r => r.json())
      .then(d => { d.success ? setData(d.data) : setError(d.error || '載入失敗') })
      .catch(() => setError('網路錯誤，請稍後再試'))
  }, [params.id])
  useEffect(() => { load() }, [load])

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    const res = await fetch(`/api/admin/care/cases/${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(okMsg); setCancelling(false); load()
  }

  if (error) return (
    <div className="max-w-3xl mx-auto card p-8 text-center">
      <p className="text-red-600 font-bold text-lg">⚠️ {error}</p>
      <Link href="/admin/care/cases" className="btn-secondary mt-4 inline-flex">回案件清單</Link>
    </div>
  )
  if (!data) return <div className="max-w-3xl mx-auto card p-10 text-center text-gray-600">載入中…</div>

  const c = data.case
  const confirmed = data.quotes.find(q => q.status === 'confirmed')

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/care/cases" className="text-gray-600 text-sm inline-flex min-h-[48px] items-center">← 回案件清單</Link>

      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono font-bold text-gray-800">{c.case_no}</span>
          <span className={`px-2 py-1 rounded-md text-[13px] font-bold ${statusChipClass('case', c.status)}`}>
            {labelFor(CASE_STATUS_LABELS, c.status)}
          </span>
        </div>
        {data.intake && (
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-gray-600 text-[13px]">就醫情境</p>
              <p className="text-gray-900 text-[15px] font-semibold">{labelFor(SCENARIO_LABELS, data.intake.service_scenario)}</p></div>
            <div><p className="text-gray-600 text-[13px]">預計就醫日期</p>
              <p className="text-gray-900 text-[15px] font-semibold">{data.intake.scheduled_service_date}</p></div>
            <div><p className="text-gray-600 text-[13px]">縣市／院所</p>
              <p className="text-gray-900 text-[15px] font-semibold">{data.intake.county} {data.intake.hospital_name}</p></div>
            <div><p className="text-gray-600 text-[13px]">聯絡人</p>
              <p className="text-gray-900 text-[15px] font-semibold">{data.intake.contact_name}・{data.intake.contact_phone}</p></div>
          </div>
        )}
        {c.cancel_reason_code && (
          <p className="text-gray-700 text-[15px] mt-3">
            取消原因：{labelFor(CASE_CANCEL_REASON_LABELS, c.cancel_reason_code)}
          </p>
        )}
        <p className="mt-3">
          <Link href={`/admin/care/intakes/${c.intake_id}`}
            className="text-green-700 font-semibold text-[15px] underline">查看原始初評</Link>
        </p>
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-gray-800 text-base">報價</h2>
          {c.status !== 'cancelled' && (
            <Link href={`/admin/care/quotes/new?case=${c.id}`} className="btn-secondary">建立報價草稿</Link>
          )}
        </div>
        {data.quotes.length === 0 ? (
          <p className="text-gray-600 text-[15px]">尚未建立報價。建立並發送報價後，案件才會進入「等待家屬確認」。</p>
        ) : (
          <div className="space-y-2">
            {data.quotes.map(q => (
              <Link key={q.id} href={`/admin/care/quotes/${q.id}`}
                className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3 hover:border-green-400">
                <div>
                  <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${statusChipClass('quote', q.status)}`}>
                    {labelFor(QUOTE_STATUS_LABELS, q.status)}
                  </span>
                  <span className="text-gray-600 text-[13px] ml-2">第 {q.version} 版</span>
                  <p className="text-gray-900 text-[15px] font-semibold mt-1">{q.service_name_snapshot}</p>
                </div>
                <p className="font-bold text-gray-900">{formatPrice(q.total_estimate)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-base mb-3">案件操作</h2>

        {c.status === 'awaiting_payment' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
            <p className="font-bold text-amber-900 text-[15px] mb-1">人工確認收款</p>
            <p className="text-amber-900 text-[15px] leading-relaxed mb-3">
              系統<strong>沒有串接任何金流</strong>，這個動作不是付款證明。
              請先在銀行端確認實際入帳，再按下按鈕。
              {confirmed && <>本案已確認報價預估 {formatPrice(confirmed.total_estimate)}。</>}
            </p>
            <button disabled={busy}
              onClick={() => act({ action: 'mark_payment_received' }, '已標記為準備媒合')}
              className="btn-primary">已確認收款，進入準備媒合</button>
          </div>
        )}

        {c.status === 'ready_to_match' && (
          <p className="text-gray-700 text-[15px] leading-relaxed mb-3">
            已準備媒合。陪診員媒合與派工不在本輪範圍，需由客服另行安排。
            {c.payment_marked_by && <>（收款由 {c.payment_marked_by} 確認）</>}
          </p>
        )}

        {c.status === 'cancelled' ? (
          <p className="text-gray-600 text-[15px]">案件已取消，不能再變更。</p>
        ) : cancelling ? (
          <div className="space-y-3">
            <label className="form-label" htmlFor="cancel-reason">取消原因</label>
            <select id="cancel-reason" className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
              {Object.entries(CASE_CANCEL_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => act({ action: 'cancel', reason_code: reason }, '案件已取消')}
                className="btn-danger">確定取消案件</button>
              <button onClick={() => setCancelling(false)} className="btn-secondary">返回</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCancelling(true)} className="btn-danger">取消案件</button>
        )}
      </div>
    </div>
  )
}
