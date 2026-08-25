'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  EVENT_LABELS, RECORD_STATUS_LABELS, SUMMARY_STATUS_LABELS,
  INCIDENT_TYPE_LABELS, INCIDENT_STATUS_LABELS, SCOPE_LABELS,
  INVALIDATE_REASON_LABELS, labelOf, chipClass,
} from '@/lib/care/fulfilment/labels'

interface Detail {
  booking: any
  events: any[]
  record: any | null
  summaries: any[]
  incidents: any[]
  authorizations: any[]
}

const EMPTY_SUMMARY = {
  service_window_text: '', completed_steps_text: '',
  family_actions_text: '', next_arrangement_text: '', handover_status_text: '',
}

export default function CareServiceDetailPage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_SUMMARY })
  const [granting, setGranting] = useState(false)
  const [grant, setGrant] = useState({ user_id: '', scope: 'view_service_summary' })

  const load = useCallback(() => {
    fetch(`/api/admin/care/services/${params.id}`).then(r => r.json())
      .then(x => { x.success ? setD(x.data) : setError(x.error || '載入失敗') })
      .catch(() => setError('網路錯誤，請稍後再試'))
  }, [params.id])
  useEffect(() => { load() }, [load])

  const post = async (body: Record<string, unknown>, msg: string) => {
    const res = await fetch(`/api/admin/care/services/${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const x = await res.json()
    if (!x.success) return toast.error(x.error || '操作失敗')
    toast.success(msg); setGranting(false); load()
  }

  const createSummary = async () => {
    const res = await fetch('/api/admin/care/summaries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: Number(params.id), ...form }),
    })
    const x = await res.json()
    if (!x.success) return toast.error(x.error || '建立失敗')
    toast.success('小結草稿已建立'); setCreating(false); setForm({ ...EMPTY_SUMMARY }); load()
  }

  if (error) return (
    <div className="max-w-3xl mx-auto card p-8 text-center">
      <p className="text-red-600 font-bold text-lg">⚠️ {error}</p>
      <Link href="/admin/care/service-control" className="btn-secondary mt-4 inline-flex">回服務控制台</Link>
    </div>
  )
  if (!d) return <div className="max-w-3xl mx-auto card p-10 text-center text-gray-600">載入中…</div>

  const b = d.booking

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/care/service-control" className="text-gray-600 text-sm inline-flex min-h-[48px] items-center">← 回服務控制台</Link>

      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-mono font-bold text-gray-800">{b.booking_no}</span>
          <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-gray-100 text-gray-700">{b.status}</span>
        </div>
        <p className="font-semibold text-gray-900 text-[15px]">{b.service_date}・{b.service_name}</p>
        <p className="text-gray-600 text-sm mt-0.5">{b.county} {b.hospital}｜就診人：{b.patient_name}</p>
      </div>

      {/* 事件時間軸 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-1">服務事件時間軸</h2>
        <p className="text-gray-600 text-[13px] mb-3">
          事件預設只有內部看得到。要讓家屬看到，需在這裡逐筆開啟。
        </p>
        {d.events.length === 0 ? (
          <p className="text-gray-600 text-[15px]">尚無事件紀錄</p>
        ) : (
          <div className="space-y-2">
            {d.events.map(e => (
              <div key={e.id}
                className={`border rounded-xl p-3 ${e.invalidated_at ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 text-[15px]">{labelOf(EVENT_LABELS, e.event_type)}</span>
                  <span className="text-gray-600 text-[13px]">{e.occurred_at?.slice(11, 16)}</span>
                  {e.visibility === 'family' && (
                    <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-green-100 text-green-800">家屬可見</span>
                  )}
                  {e.invalidated_at && (
                    <span className="px-2 py-0.5 rounded-md text-[13px] font-semibold bg-gray-200 text-gray-700">
                      已作廢・{labelOf(INVALIDATE_REASON_LABELS, e.invalidate_reason_code)}
                    </span>
                  )}
                </div>
                {e.family_note && <p className="text-gray-700 text-[15px] mt-1">{e.family_note}</p>}
                {!e.invalidated_at && (
                  <button
                    onClick={() => post({ action: 'set_event_visibility', event_id: e.id, visible: e.visibility !== 'family' }, '已更新可見性')}
                    className="text-[13px] font-semibold text-green-700 underline mt-2 min-h-[48px]">
                    {e.visibility === 'family' ? '改為僅內部可見' : '開放給家屬看'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 服務紀錄 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-2">內部服務紀錄</h2>
        {!d.record ? (
          <p className="text-gray-600 text-[15px]">陪診員尚未建立服務紀錄</p>
        ) : (
          <>
            <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(d.record.status)}`}>
              {labelOf(RECORD_STATUS_LABELS, d.record.status)}
            </span>
            {d.record.objective_summary && (
              <p className="text-gray-800 text-[15px] leading-relaxed mt-2 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                {d.record.objective_summary}
              </p>
            )}
            <p className="mt-2">
              <Link href="/admin/care/records?status=submitted" className="text-green-700 font-semibold text-[15px] underline">
                到服務紀錄審核處理
              </Link>
            </p>
          </>
        )}
      </div>

      {/* 家屬小結 */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-gray-800 text-base">家屬小結</h2>
          {!creating && <button onClick={() => setCreating(true)} className="btn-secondary">建立新版本草稿</button>}
        </div>

        {d.summaries.length === 0 && !creating && (
          <p className="text-gray-600 text-[15px]">尚未建立小結。家屬在小結發布前看不到任何服務內容。</p>
        )}

        {d.summaries.map(s => (
          <div key={s.id} className="border border-gray-200 rounded-xl p-3 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(s.status)}`}>
                {labelOf(SUMMARY_STATUS_LABELS, s.status)}
              </span>
              <span className="text-gray-600 text-[13px]">第 {s.version_number} 版</span>
            </div>
            <p className="text-gray-700 text-[15px] mt-1">{s.completed_steps_text}</p>
          </div>
        ))}

        {creating && (
          <div className="space-y-3 mt-3">
            <p className="text-gray-600 text-[13px] leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              只寫客觀流程與需家屬處理的事項。<strong>不可寫診斷、用藥、治療建議或病歷內容</strong>；
              需要家屬向院方確認的事，請寫成「請家屬向醫療人員確認…」。
            </p>
            {([
              ['service_window_text', '服務時間', '例：09:10 至 12:40'],
              ['completed_steps_text', '已完成流程', '例：已完成報到、抽血、看診與領藥'],
              ['family_actions_text', '需家屬確認事項（選填）', '例：請家屬向院方確認下次回診時段'],
              ['next_arrangement_text', '下次安排（選填）', '例：院方提到約兩週後回診'],
              ['handover_status_text', '交接狀態（選填）', '例：已於一樓大廳與家屬會合完成交接'],
            ] as const).map(([k, label, ph]) => (
              <div key={k}>
                <label className="form-label" htmlFor={k}>{label}</label>
                <textarea id={k} className="form-input" rows={2} placeholder={ph}
                  value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={createSummary} className="btn-primary">建立草稿</button>
              <button onClick={() => { setCreating(false); setForm({ ...EMPTY_SUMMARY }) }} className="btn-secondary">取消</button>
            </div>
          </div>
        )}
      </div>

      {/* 異常事件 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-2">異常事件</h2>
        {d.incidents.length === 0 ? <p className="text-gray-600 text-[15px]">沒有異常事件</p> : (
          <div className="space-y-2">
            {d.incidents.map(i => (
              <div key={i.id} className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(i.status)}`}>
                  {labelOf(INCIDENT_STATUS_LABELS, i.status)}
                </span>
                <span className="text-gray-800 text-[15px]">{labelOf(INCIDENT_TYPE_LABELS, i.incident_type)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 家屬授權 */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="font-bold text-gray-800 text-base">家屬授權</h2>
          {!granting && <button onClick={() => setGranting(true)} className="btn-secondary">開通授權</button>}
        </div>
        <p className="text-gray-600 text-[13px] leading-relaxed mb-3">
          付款人、預約人、聯絡人<strong>都不會自動取得閱覽權</strong>。
          必須在這裡對特定會員帳號逐一開通，家屬端才看得到已發布的小結與進度。
        </p>

        {d.authorizations.length === 0 ? (
          <p className="text-gray-600 text-[15px]">尚未開通任何授權</p>
        ) : (
          <div className="space-y-2">
            {d.authorizations.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-gray-900 text-[15px] font-semibold">{labelOf(SCOPE_LABELS, a.scope)}</p>
                  <p className="text-gray-600 text-[13px] font-mono truncate">{a.user_id}</p>
                </div>
                {a.revoked_at ? (
                  <span className="text-gray-500 text-[13px] flex-shrink-0">已撤回</span>
                ) : (
                  <button onClick={() => post({ action: 'revoke_authorization', authorization_id: a.id }, '已撤回授權')}
                    className="text-[13px] font-semibold text-red-700 underline flex-shrink-0 min-h-[48px]">撤回</button>
                )}
              </div>
            ))}
          </div>
        )}

        {granting && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="form-label" htmlFor="uid">會員識別碼（UUID）</label>
              <input id="uid" className="form-input" placeholder="3f9a2c8e-14b7-460d-9e2f-5a1c8d3b7e60"
                value={grant.user_id} onChange={e => setGrant(g => ({ ...g, user_id: e.target.value }))} />
            </div>
            <div>
              <label className="form-label" htmlFor="scope">授權範圍</label>
              <select id="scope" className="form-input" value={grant.scope}
                onChange={e => setGrant(g => ({ ...g, scope: e.target.value }))}>
                <option value="view_service_summary">閱讀服務小結</option>
                <option value="receive_service_notification">接收服務進度</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button disabled={!grant.user_id.trim()}
                onClick={() => post({ action: 'grant_authorization', ...grant }, '授權已開通')}
                className="btn-primary disabled:opacity-40">開通</button>
              <button onClick={() => setGranting(false)} className="btn-secondary">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
