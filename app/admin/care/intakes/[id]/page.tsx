'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  INTAKE_STATUS_LABELS, SCENARIO_LABELS, MOBILITY_LABELS, TIME_PREFERENCE_LABELS,
  CONTACT_PREFERENCE_LABELS, DECLINE_REASON_LABELS, labelFor, statusChipClass,
} from '@/lib/care/labels'

interface Intake {
  id: number; service_scenario: string; mobility_support_level: string
  transport_support_requested: boolean; hospital_name: string; county: string
  scheduled_service_date: string; time_preference: string
  contact_name: string; contact_phone: string; contact_line_id: string | null
  contact_preference: string; relationship_to_beneficiary: string
  limited_support_note: string | null
  status: string; decline_reason_code: string | null; review_note: string | null
  created_at: string; updated_at: string; reviewed_at: string | null
}

export default function CareIntakeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [row, setRow] = useState<Intake | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'' | 'more_info' | 'decline'>('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('out_of_service_area')

  const load = useCallback(() => {
    fetch(`/api/admin/care/intakes/${params.id}`)
      .then(r => r.json())
      .then(d => { d.success ? setRow(d.data) : setError(d.error || '載入失敗') })
      .catch(() => setError('網路錯誤，請稍後再試'))
  }, [params.id])
  useEffect(() => { load() }, [load])

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    const res = await fetch(`/api/admin/care/intakes/${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(okMsg)
    setMode(''); setNote('')
    if (body.action === 'convert_to_case' && d.data?.case_id) {
      router.push(`/admin/care/cases/${d.data.case_id}`)
      return
    }
    load()
  }

  if (error) return (
    <div className="max-w-3xl mx-auto card p-8 text-center">
      <p className="text-red-600 font-bold text-lg">⚠️ {error}</p>
      <Link href="/admin/care/intakes" className="btn-secondary mt-4 inline-flex">回初評清單</Link>
    </div>
  )
  if (!row) return <div className="max-w-3xl mx-auto card p-10 text-center text-gray-600">載入中…</div>

  const canReview = row.status === 'submitted' || row.status === 'needs_more_information'
  const canDecline = ['submitted', 'in_review', 'needs_more_information'].includes(row.status)
  const canConvert = row.status === 'in_review'

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-gray-600 text-[13px]">{label}</p>
      <p className="text-gray-900 text-[15px] font-semibold">{value || '—'}</p>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/care/intakes" className="text-gray-600 text-sm inline-flex min-h-[48px] items-center">← 回初評清單</Link>

      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`px-2 py-1 rounded-md text-[13px] font-bold ${statusChipClass('intake', row.status)}`}>
            {labelFor(INTAKE_STATUS_LABELS, row.status)}
          </span>
          <span className="text-gray-600 text-[13px]">{row.created_at?.slice(0, 16).replace('T', ' ')} 送出</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="就醫情境" value={labelFor(SCENARIO_LABELS, row.service_scenario)} />
          <Field label="預計就醫日期" value={row.scheduled_service_date} />
          <Field label="縣市／院所" value={`${row.county} ${row.hospital_name}`} />
          <Field label="時段" value={labelFor(TIME_PREFERENCE_LABELS, row.time_preference)} />
          <Field label="行動協助" value={labelFor(MOBILITY_LABELS, row.mobility_support_level)} />
          <Field label="交通協助" value={row.transport_support_requested ? '需要' : '不需要'} />
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-3">聯絡方式</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="聯絡人" value={row.contact_name} />
          <Field label="與就診人關係" value={row.relationship_to_beneficiary} />
          <Field label="手機" value={row.contact_phone} />
          <Field label="偏好聯絡方式" value={labelFor(CONTACT_PREFERENCE_LABELS, row.contact_preference)} />
          <Field label="LINE ID" value={row.contact_line_id || ''} />
        </div>
        <p className="text-gray-600 text-[13px] mt-3">
          聯絡資料僅供安排本次服務使用，請勿另作他用或轉傳。
        </p>
      </div>

      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-2">補充需求</h2>
        <p className="text-gray-900 text-[15px] leading-relaxed whitespace-pre-wrap">
          {row.limited_support_note || '（未填寫）'}
        </p>
        <p className="text-gray-600 text-[13px] mt-2">
          這不是病史或診斷紀錄，僅為當天流程協助的補充說明。
        </p>
      </div>

      {(row.review_note || row.decline_reason_code) && (
        <div className="card p-5 mb-4 bg-gray-50">
          <h2 className="font-bold text-gray-800 text-base mb-2">審查紀錄</h2>
          {row.decline_reason_code && (
            <p className="text-gray-900 text-[15px]">
              婉拒原因：{labelFor(DECLINE_REASON_LABELS, row.decline_reason_code)}
            </p>
          )}
          {row.review_note && (
            <p className="text-gray-700 text-[15px] leading-relaxed mt-1 whitespace-pre-wrap">{row.review_note}</p>
          )}
        </div>
      )}

      {/* 固定操作 */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-base mb-3">初評操作</h2>

        {row.status === 'declined' && <p className="text-gray-600 text-[15px]">這筆初評已婉拒，不能再變更。</p>}
        {row.status === 'converted_to_case' && <p className="text-gray-600 text-[15px]">已轉為案件，後續請到「陪診案件」處理。</p>}

        {mode === '' && (
          <div className="flex flex-wrap gap-2">
            {canReview && (
              <button disabled={busy} onClick={() => act({ action: 'start_review' }, '已開始審查')}
                className="btn-primary">開始審查</button>
            )}
            {row.status === 'in_review' && (
              <button disabled={busy} onClick={() => setMode('more_info')} className="btn-secondary">要求補充資料</button>
            )}
            {canConvert && (
              <button disabled={busy} onClick={() => act({ action: 'convert_to_case' }, '已轉為案件')}
                className="btn-primary">確認可服務，轉為案件</button>
            )}
            {canDecline && (
              <button disabled={busy} onClick={() => setMode('decline')} className="btn-danger">婉拒</button>
            )}
          </div>
        )}

        {mode === 'more_info' && (
          <div className="space-y-3">
            <label className="form-label" htmlFor="more-info-note">需要家屬補充什麼？</label>
            <textarea id="more-info-note" className="form-input" rows={3} maxLength={500}
              placeholder="例：請補充預計的檢查項目與預估結束時間"
              value={note} onChange={e => setNote(e.target.value)} />
            <p className="text-gray-600 text-[13px]">{note.length} / 500 字，請勿填寫診斷或用藥內容</p>
            <div className="flex gap-2">
              <button disabled={busy || !note.trim()}
                onClick={() => act({ action: 'request_more_information', review_note: note }, '已標記為需補資料')}
                className="btn-primary">送出</button>
              <button onClick={() => { setMode(''); setNote('') }} className="btn-secondary">取消</button>
            </div>
          </div>
        )}

        {mode === 'decline' && (
          <div className="space-y-3">
            <label className="form-label" htmlFor="decline-reason">婉拒原因</label>
            <select id="decline-reason" className="form-input" value={reason} onChange={e => setReason(e.target.value)}>
              {Object.entries(DECLINE_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="form-label" htmlFor="decline-note">補充說明（選填）</label>
            <textarea id="decline-note" className="form-input" rows={2} maxLength={500}
              value={note} onChange={e => setNote(e.target.value)} />
            <div className="flex gap-2">
              <button disabled={busy}
                onClick={() => act({ action: 'decline', reason_code: reason, review_note: note || undefined }, '已婉拒')}
                className="btn-danger">確定婉拒</button>
              <button onClick={() => { setMode(''); setNote('') }} className="btn-secondary">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
