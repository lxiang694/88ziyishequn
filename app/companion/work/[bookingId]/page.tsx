'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import {
  EVENT_LABELS, RECORD_STATUS_LABELS, INCIDENT_TYPE_LABELS,
  INCIDENT_STATUS_LABELS, FOLLOW_UP_REASON_LABELS, SUMMARY_STATUS_LABELS,
  INVALIDATE_REASON_LABELS, labelOf, chipClass,
} from '@/lib/care/fulfilment/labels'

/** 陪診員只能記錄客觀流程；醫療內容由伺服器端擋下 */
const EVENT_BUTTONS = [
  'staff_arrived', 'beneficiary_met', 'registration_or_checkin_completed',
  'waiting_or_process_in_progress', 'process_transition',
  'return_arrangement_confirmed', 'service_handover_ready',
  'requires_supervisor_attention',
]

const STEPS = [
  ['met_completed', '已與就診人會合'],
  ['checkin_completed', '已完成報到'],
  ['process_handover_completed', '院內流程已銜接完成'],
  ['return_arrangement_completed', '返程安排已完成'],
  ['family_contact_completed', '已聯繫家屬'],
] as const

export default function CompanionWorkPage({ params }: { params: { bookingId: string } }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [rec, setRec] = useState<any>({
    met_completed: false, checkin_completed: false, process_handover_completed: false,
    return_arrangement_completed: false, family_contact_completed: false,
    family_follow_up_needed: false, follow_up_reason_code: 'family_confirmation_needed',
    objective_summary: '',
  })
  const [incType, setIncType] = useState('family_contact_needed')
  const [incDesc, setIncDesc] = useState('')
  const [showInc, setShowInc] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/companion/service/${params.bookingId}`).then(r => r.json())
      .then(x => {
        if (!x.success) { setError(x.error || '載入失敗'); return }
        setD(x.data)
        if (x.data.record) setRec({ ...rec, ...x.data.record, objective_summary: x.data.record.objective_summary || '' })
      })
      .catch(() => setError('網路錯誤，請稍後再試'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.bookingId])
  useEffect(() => { load() }, [load])

  const post = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    const res = await fetch(`/api/companion/service/${params.bookingId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const x = await res.json()
    setBusy(false)
    if (!x.success) { toast.error(x.error || '操作失敗'); return false }
    toast.success(msg); load(); return true
  }

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <p className="text-red-700 font-bold text-lg mb-3">{error}</p>
      <Link href="/companion" className="btn-secondary inline-flex">回工作列表</Link>
    </div>
  )
  if (!d) return <div className="max-w-2xl mx-auto px-4 py-10 text-center t-body">載入中…</div>

  const editable = d.record ? ['draft', 'returned_for_revision'].includes(d.record.status) : true

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <Link href="/companion" className="t-meta inline-flex min-h-[48px] items-center">← 回工作列表</Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <p className="font-mono font-bold text-gray-800 text-[13px]">{d.booking.booking_no}</p>
        <p className="font-bold text-gray-900 text-lg mt-1">{d.booking.service_date}・{d.booking.service_name}</p>
        <p className="t-meta mt-0.5">{d.booking.hospital}｜就診人：{d.booking.patient_name}</p>
      </div>

      {/* 記錄流程節點 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="t-section-title mb-1">記錄流程節點</h2>
        <p className="t-meta mb-3">
          時間由系統自動記錄。這些是客觀流程節點，<strong>不要記錄診斷、用藥或醫師的醫療判斷</strong>。
        </p>

        <label className="form-label" htmlFor="note">給家屬的簡短說明（選填，最多 120 字）</label>
        <input id="note" className="form-input mb-3" maxLength={120}
          placeholder="例：已抵達一樓大廳，準備協助報到"
          value={note} onChange={e => setNote(e.target.value)} />

        <div className="grid grid-cols-2 gap-2">
          {EVENT_BUTTONS.map(t => (
            <button key={t} disabled={busy}
              onClick={async () => { if (await post({ action: 'append_event', event_type: t, family_note: note || undefined }, '已記錄')) setNote('') }}
              className={`min-h-[48px] rounded-xl border-2 text-[15px] font-semibold px-3 ${t === 'requires_supervisor_attention' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-800'}`}>
              {labelOf(EVENT_LABELS, t)}
            </button>
          ))}
        </div>
      </div>

      {/* 時間軸 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="t-section-title mb-3">今日紀錄</h2>
        {d.events.length === 0 ? <p className="t-body">尚無紀錄</p> : (
          <div className="space-y-2">
            {d.events.map((e: any) => (
              <div key={e.id} className={`border rounded-xl p-3 ${e.invalidated_at ? 'opacity-60 bg-gray-50 border-gray-200' : 'border-gray-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 text-[15px]">{labelOf(EVENT_LABELS, e.event_type)}</span>
                  <span className="t-meta">{e.occurred_at?.slice(11, 16)}</span>
                  {e.invalidated_at && (
                    <span className="text-[13px] px-2 py-0.5 rounded-md bg-gray-200 text-gray-700">
                      已更正・{labelOf(INVALIDATE_REASON_LABELS, e.invalidate_reason_code)}
                    </span>
                  )}
                </div>
                {e.family_note && <p className="t-body mt-1">{e.family_note}</p>}
                {!e.invalidated_at && (
                  <button disabled={busy}
                    onClick={() => post({ action: 'invalidate_event', event_id: e.id, reason_code: 'entered_by_mistake' }, '已標記為誤填')}
                    className="text-[13px] font-semibold text-gray-600 underline mt-2 min-h-[48px]">
                    記錯了，標記更正
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="t-meta mt-3">紀錄一旦送出就不會消失，更正只會標記，不會刪掉原本的內容。</p>
      </div>

      {/* 服務紀錄 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="t-section-title">服務紀錄</h2>
          {d.record && (
            <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(d.record.status)}`}>
              {labelOf(RECORD_STATUS_LABELS, d.record.status)}
            </span>
          )}
        </div>
        <p className="t-meta mb-3">
          只填<strong>客觀流程</strong>與<strong>需家屬處理的事項</strong>。
          不要填診斷、藥物、劑量或治療建議 —— 那些請家屬直接詢問醫療人員。
        </p>

        {d.record?.status === 'returned_for_revision' && (
          <p className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 t-body text-orange-900 mb-3">
            督導退回補正，請修改後重新送出。
          </p>
        )}

        <div className="space-y-2 mb-3">
          {STEPS.map(([k, label]) => (
            <label key={k} className={`flex items-center gap-3 p-3 rounded-xl border-2 min-h-[48px] ${rec[k] ? 'border-green-500 bg-green-50' : 'border-gray-200'} ${editable ? 'cursor-pointer' : 'opacity-60'}`}>
              <input type="checkbox" className="w-5 h-5 rounded accent-green-700" disabled={!editable}
                checked={!!rec[k]} onChange={e => setRec((r: any) => ({ ...r, [k]: e.target.checked }))} />
              <span className="text-gray-800 text-[15px] font-semibold">{label}</span>
            </label>
          ))}
        </div>

        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 min-h-[48px] mb-2 ${rec.family_follow_up_needed ? 'border-amber-400 bg-amber-50' : 'border-gray-200'} ${editable ? 'cursor-pointer' : 'opacity-60'}`}>
          <input type="checkbox" className="w-5 h-5 rounded accent-amber-600" disabled={!editable}
            checked={!!rec.family_follow_up_needed}
            onChange={e => setRec((r: any) => ({ ...r, family_follow_up_needed: e.target.checked }))} />
          <span className="text-gray-800 text-[15px] font-semibold">有需要家屬後續處理的事項</span>
        </label>

        {rec.family_follow_up_needed && (
          <select className="form-input mb-3" disabled={!editable} value={rec.follow_up_reason_code}
            aria-label="需家屬處理的原因"
            onChange={e => setRec((r: any) => ({ ...r, follow_up_reason_code: e.target.value }))}>
            {Object.entries(FOLLOW_UP_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}

        <label className="form-label" htmlFor="objective">客觀說明（最多 500 字）</label>
        <textarea id="objective" className="form-input" rows={4} maxLength={500} disabled={!editable}
          placeholder="例：09:10 抵達，協助完成報到後於三樓檢查區等待，11:20 完成檢查並協助領藥。"
          value={rec.objective_summary} onChange={e => setRec((r: any) => ({ ...r, objective_summary: e.target.value }))} />

        {editable && (
          <div className="flex gap-2 mt-3">
            <button disabled={busy}
              onClick={() => post({ action: 'save_record_draft', ...rec, objective_summary: rec.objective_summary || undefined }, '已儲存草稿')}
              className="btn-secondary flex-1">儲存草稿</button>
            <button disabled={busy}
              onClick={async () => {
                if (await post({ action: 'save_record_draft', ...rec, objective_summary: rec.objective_summary || undefined }, '已儲存')) {
                  await post({ action: 'submit_record' }, '已送出給督導核對')
                }
              }}
              className="btn-primary flex-1">送出核對</button>
          </div>
        )}
      </div>

      {/* 異常事件 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="t-section-title mb-1">需要督導協助</h2>
        <p className="t-meta mb-3">
          現場<strong>緊急狀況請先依院方流程與服務 SOP 立即處理</strong>，這裡只是事後的營運記錄與升級，不能取代即時應變。
        </p>

        {d.incidents.map((i: any) => (
          <div key={i.id} className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(i.status)}`}>
              {labelOf(INCIDENT_STATUS_LABELS, i.status)}
            </span>
            <span className="text-gray-800 text-[15px]">{labelOf(INCIDENT_TYPE_LABELS, i.incident_type)}</span>
          </div>
        ))}

        {showInc ? (
          <div className="space-y-3 mt-2">
            <select className="form-input" value={incType} onChange={e => setIncType(e.target.value)} aria-label="異常類型">
              {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <textarea className="form-input" rows={3} maxLength={300} aria-label="狀況說明"
              placeholder="請描述客觀狀況與需要什麼協助"
              value={incDesc} onChange={e => setIncDesc(e.target.value)} />
            <div className="flex gap-2">
              <button disabled={busy}
                onClick={async () => {
                  if (await post({ action: 'create_incident', incident_type: incType, description: incDesc || undefined }, '已通知督導')) {
                    setShowInc(false); setIncDesc('')
                  }
                }}
                className="btn-primary flex-1">送出</button>
              <button onClick={() => setShowInc(false)} className="btn-secondary">取消</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowInc(true)} className="btn-secondary w-full mt-2">回報需要協助的狀況</button>
        )}
      </div>

      {/* 小結進度 */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
        <h2 className="font-bold text-gray-800 text-base mb-1">家屬小結</h2>
        <p className="t-body">
          目前狀態：<strong>
            {d.summary_state === 'none' ? '尚未建立' : labelOf(SUMMARY_STATUS_LABELS, d.summary_state)}
          </strong>
        </p>
        <p className="t-meta mt-1">
          小結由督導審核後發布給家屬，陪診員不能自行發布，也看不到小結內容。
        </p>
      </div>

      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: '16px', fontWeight: '600' } }} />
    </div>
  )
}
