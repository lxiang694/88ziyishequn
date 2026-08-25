'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import CareQuoteForm, { type QuoteFormValue } from '@/components/admin/CareQuoteForm'
import {
  QUOTE_STATUS_LABELS, CASE_CANCEL_REASON_LABELS, labelFor, statusChipClass,
} from '@/lib/care/labels'

interface Quote {
  id: number; care_case_id: number; version: number; status: string; currency: string
  service_code: string; service_name_snapshot: string; base_fee: number
  travel_estimate_amount: number; travel_estimate_basis: string
  overtime_rule_snapshot: string; total_estimate: number; valid_until: string
  sent_at: string | null; confirmed_at: string | null; confirmed_by_label: string | null
  cancel_reason_code: string | null; created_at: string
}
interface Item { id: number; item_code: string; label_snapshot: string; unit_price: number; quantity: number; line_total: number }

export default function CareQuoteDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<{ quote: Quote; items: Item[] } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<'' | 'confirm' | 'cancel'>('')
  const [confirmedBy, setConfirmedBy] = useState('')
  const [reason, setReason] = useState('quote_rejected')

  const load = useCallback(() => {
    fetch(`/api/admin/care/quotes/${params.id}`)
      .then(r => r.json())
      .then(d => { d.success ? setData(d.data) : setError(d.error || '載入失敗') })
      .catch(() => setError('網路錯誤，請稍後再試'))
  }, [params.id])
  useEffect(() => { load() }, [load])

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    const res = await fetch(`/api/admin/care/quotes/${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(okMsg); setMode(''); setEditing(false); load()
  }

  if (error) return (
    <div className="max-w-3xl mx-auto card p-8 text-center">
      <p className="text-red-600 font-bold text-lg">⚠️ {error}</p>
      <Link href="/admin/care/quotes" className="btn-secondary mt-4 inline-flex">回報價清單</Link>
    </div>
  )
  if (!data) return <div className="max-w-3xl mx-auto card p-10 text-center text-gray-600">載入中…</div>

  const q = data.quote
  const isDraft = q.status === 'draft'
  const frozen = ['confirmed', 'expired', 'cancelled'].includes(q.status)

  const saveDraft = async (v: QuoteFormValue) => {
    await act({ action: 'update_draft', ...v }, '草稿已更新')
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/admin/care/cases/${q.care_case_id}`} className="text-gray-600 text-sm inline-flex min-h-[48px] items-center">← 回案件</Link>

      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`px-2 py-1 rounded-md text-[13px] font-bold ${statusChipClass('quote', q.status)}`}>
            {labelFor(QUOTE_STATUS_LABELS, q.status)}
          </span>
          <span className="text-gray-600 text-[13px]">第 {q.version} 版・有效至 {q.valid_until}</span>
        </div>

        <h1 className="text-lg font-bold text-gray-900">{q.service_name_snapshot}</h1>

        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-[15px]">
            <span className="text-gray-700">基本服務費（快照）</span>
            <span className="font-semibold text-gray-900">{formatPrice(q.base_fee)}</span>
          </div>
          {data.items.map(it => (
            <div key={it.id} className="flex justify-between text-[15px]">
              <span className="text-gray-700">{it.label_snapshot} × {it.quantity}</span>
              <span className="font-semibold text-gray-900">{formatPrice(it.line_total)}</span>
            </div>
          ))}
          <div className="flex justify-between text-[15px]">
            <span className="text-gray-700">交通預估</span>
            <span className="font-semibold text-gray-900">{formatPrice(q.travel_estimate_amount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
            <span className="text-gray-900">預估合計（{q.currency}）</span>
            <span className="text-gray-900">{formatPrice(q.total_estimate)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-[15px] text-gray-700 leading-relaxed">
          <p><strong className="text-gray-900">交通計價：</strong>{q.travel_estimate_basis}</p>
          <p><strong className="text-gray-900">超時規則：</strong>{q.overtime_rule_snapshot}</p>
        </div>

        {q.confirmed_at && (
          <p className="text-gray-700 text-[15px] mt-3">
            由 {q.confirmed_by_label} 於 {q.confirmed_at.slice(0, 16).replace('T', ' ')} 確認
          </p>
        )}
        {q.cancel_reason_code && (
          <p className="text-gray-700 text-[15px] mt-1">
            作廢原因：{labelFor(CASE_CANCEL_REASON_LABELS, q.cancel_reason_code)}
          </p>
        )}
      </div>

      {editing && isDraft && (
        <div className="card p-5 mb-4">
          <h2 className="font-bold text-gray-800 text-base mb-3">編輯草稿</h2>
          <CareQuoteForm submitLabel="儲存草稿" onSubmit={saveDraft} initial={{
            service_code: q.service_code,
            travel_estimate_amount: q.travel_estimate_amount,
            travel_estimate_basis: q.travel_estimate_basis,
            overtime_rule_snapshot: q.overtime_rule_snapshot,
            valid_until: q.valid_until,
            items: data.items.map(i => ({
              item_code: i.item_code, label_snapshot: i.label_snapshot,
              unit_price: i.unit_price, quantity: i.quantity,
            })),
          }} />
          <button onClick={() => setEditing(false)} className="btn-secondary w-full mt-2">取消編輯</button>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-base mb-3">報價操作</h2>

        {frozen && (
          <p className="text-gray-600 text-[15px] mb-3">
            狀態為「{labelFor(QUOTE_STATUS_LABELS, q.status)}」的報價已凍結，金額與快照不可修改。
            需要調整請建立新版本報價。
          </p>
        )}

        {mode === '' && (
          <div className="flex flex-wrap gap-2">
            {isDraft && !editing && <button onClick={() => setEditing(true)} className="btn-secondary">編輯草稿</button>}
            {isDraft && <button disabled={busy} onClick={() => act({ action: 'send' }, '報價已發送')} className="btn-primary">發送給家屬</button>}
            {q.status === 'sent' && <button disabled={busy} onClick={() => setMode('confirm')} className="btn-primary">家屬已確認</button>}
            {q.status === 'sent' && <button disabled={busy} onClick={() => act({ action: 'expire' }, '已設為過期')} className="btn-secondary">設為過期</button>}
            {(isDraft || q.status === 'sent' || q.status === 'confirmed') && (
              <button disabled={busy} onClick={() => setMode('cancel')} className="btn-danger">作廢</button>
            )}
          </div>
        )}

        {mode === 'confirm' && (
          <div className="space-y-3">
            <label className="form-label" htmlFor="confirmed-by">由誰確認</label>
            <input id="confirmed-by" className="form-input" maxLength={40}
              placeholder="例：王小姐（女兒）"
              value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} />
            <p className="text-gray-600 text-[13px]">
              記錄實際確認的家屬；本輪不代表付款人具有所有資料權。
            </p>
            <div className="flex gap-2">
              <button disabled={busy || !confirmedBy.trim()}
                onClick={() => act({ action: 'confirm', confirmed_by_label: confirmedBy }, '報價已確認')}
                className="btn-primary">確認報價</button>
              <button onClick={() => setMode('')} className="btn-secondary">取消</button>
            </div>
          </div>
        )}

        {mode === 'cancel' && (
          <div className="space-y-3">
            <label className="form-label" htmlFor="quote-cancel-reason">作廢原因</label>
            <select id="quote-cancel-reason" className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
              {Object.entries(CASE_CANCEL_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => act({ action: 'cancel', reason_code: reason }, '報價已作廢')}
                className="btn-danger">確定作廢</button>
              <button onClick={() => setMode('')} className="btn-secondary">返回</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
