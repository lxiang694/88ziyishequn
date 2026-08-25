'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { formatPrice, formatDateTime } from '@/lib/utils'
import { BOOKING_STATUSES, TIME_SLOTS, MOBILITY_OPTIONS, ADDON_OPTIONS, labelOf, statusColor, eventMeta } from '@/lib/careMeta'

interface Booking {
  id: number; booking_no: string; service_name: string; price: number
  patient_name: string; patient_age: string; patient_gender: string; mobility: string
  contact_name: string; contact_phone: string; contact_line: string; relation: string
  service_date: string; time_slot: string; county: string; hospital: string; department: string
  addons: string[]; notes: string; status: string; admin_note: string; created_at: string
  companion_id: number | null
  companions?: { id: number; name: string; phone: string } | null
}
interface Companion { id: number; name: string; phone: string; status: string; available?: boolean }

interface CareEvent {
  id: number; event_type: string; note: string | null
  created_at: string; companion_name: string; photo_urls: string[]
}

/** 服務過程記錄時間軸（含現場照片） */
function EventTimeline({ bookingId }: { bookingId: number }) {
  const [events, setEvents] = useState<CareEvent[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/care/events?booking_id=${bookingId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEvents(d.data); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [bookingId])

  if (!loaded) return <p className="text-gray-600 text-sm">載入服務記錄…</p>
  if (events.length === 0) {
    return <p className="text-gray-600 text-sm">陪診員尚未回報任何服務記錄</p>
  }

  return (
    <div className="space-y-3">
      {events.map(ev => {
        const m = eventMeta(ev.event_type)
        return (
          <div key={ev.id} className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">{m.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={'status-badge ' + m.color}>{m.label}</span>
                <span className="text-gray-500 text-[13px]">
                  {new Date(ev.created_at).toLocaleString('zh-TW')}
                </span>
                {ev.companion_name && <span className="text-gray-600 text-[13px]">by {ev.companion_name}</span>}
              </div>
              {ev.note && <p className="text-gray-800 text-[15px] mt-1 whitespace-pre-wrap">{ev.note}</p>}
              {ev.photo_urls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                  {ev.photo_urls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`現場照片 ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminCarePage() {
  const [rows, setRows] = useState<Booking[]>([])
  const [companions, setCompanions] = useState<Companion[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [tableMissing, setTableMissing] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (search) p.set('search', search)
    fetch('/api/admin/care/bookings?' + p)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRows(d.data); setTableMissing(!!d.table_missing) }
        else toast.error(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { toast.error('載入失敗'); setLoading(false) })
  }, [status, search])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/admin/care/companions').then(r => r.json()).then(d => { if (d.success) setCompanions(d.data) })
  }, [])

  const patch = async (id: number, body: any) => {
    const res = await fetch('/api/admin/care/bookings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    const d = await res.json()
    if (d.success) { toast.success('已更新'); load() } else toast.error(d.error || '更新失敗')
  }

  const counts = BOOKING_STATUSES.map(s => ({ s, n: rows.filter(r => r.status === s).length }))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800">🩺 陪診預約</h1>
        <p className="text-gray-600 text-sm mt-0.5">共 {rows.length} 筆・點擊列可展開詳情與派工</p>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
          ⚠️ 尚未建立陪診資料表，請在 Supabase SQL Editor 執行
          <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded">migrations/companion_care_schema.sql</code>
        </div>
      )}

      {/* 狀態統計 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {counts.map(({ s, n }) => (
          <button key={s} onClick={() => setStatus(status === s ? '' : s)}
            className={`rounded-xl border-2 p-2.5 text-center transition-colors min-h-[48px] ${status === s ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'}`}>
            <div className="font-bold text-gray-900 text-lg leading-tight">{n}</div>
            <div className="text-gray-600 text-[13px] mt-0.5">{s}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input className="form-input flex-1" placeholder="搜尋預約編號、姓名、電話…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {status && (
          <button onClick={() => setStatus('')} className="btn-secondary px-4">清除篩選</button>
        )}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-600">載入中…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-600">目前沒有預約</div>
      ) : (
        <div className="space-y-3">
          {rows.map(b => {
            const open = expanded === b.id
            return (
              <div key={b.id} className="card overflow-hidden">
                <button onClick={() => setExpanded(open ? null : b.id)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-800 text-[13px]">{b.booking_no}</span>
                        <span className={'status-badge ' + statusColor(b.status)}>{b.status}</span>
                        {b.companions && (
                          <span className="text-[13px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                            陪診：{b.companions.name}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 text-base mt-1.5">
                        {b.service_date}・{labelOf(TIME_SLOTS, b.time_slot)}
                      </p>
                      <p className="text-gray-600 text-sm mt-0.5">
                        {b.county} {b.hospital} {b.department}｜就診人：{b.patient_name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-green-700 text-lg">{formatPrice(b.price)}</div>
                      <div className="text-gray-600 text-[13px]">{b.service_name}</div>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-gray-100 bg-gray-50/60 p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">就診人</p>
                        <p className="text-base text-gray-800">{b.patient_name}
                          {b.patient_age && `・${b.patient_age} 歲`}
                          {b.patient_gender === 'female' ? '・女' : b.patient_gender === 'male' ? '・男' : ''}
                        </p>
                        <p className="text-gray-600 text-sm mt-1">行動能力：{labelOf(MOBILITY_OPTIONS, b.mobility)}</p>
                        {Array.isArray(b.addons) && b.addons.length > 0 && (
                          <p className="text-gray-600 text-sm mt-1">加購：{b.addons.map(a => labelOf(ADDON_OPTIONS, a)).join('、')}</p>
                        )}
                        {b.notes && <p className="text-amber-800 bg-amber-50 rounded-lg p-2 text-sm mt-2">備註：{b.notes}</p>}
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">聯絡人</p>
                        <p className="text-base text-gray-800">{b.contact_name}{b.relation && `（${b.relation}）`}</p>
                        <p className="text-gray-800 font-mono text-base mt-1">{b.contact_phone}</p>
                        {b.contact_line && <p className="text-gray-600 text-sm mt-1">LINE：{b.contact_line}</p>}
                        <p className="text-gray-500 text-[13px] mt-2">預約於 {formatDateTime(b.created_at)}</p>
                      </div>
                    </div>

                    {/* 服務過程記錄 */}
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-3">服務過程記錄</p>
                      <EventTimeline bookingId={b.id} />
                    </div>

                    {/* 派工 */}
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">指派陪診員</p>
                      <select className="form-input" value={b.companion_id || ''}
                        onChange={e => patch(b.id, { companion_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">— 未指派 —</option>
                        {companions.filter(c => c.status === 'active').map(c => (
                          <option key={c.id} value={c.id}>{c.name}（{c.phone}）</option>
                        ))}
                      </select>
                      <p className="text-gray-500 text-[13px] mt-1.5">
                        指派後狀態會自動改為「已派工」，陪診員可在自己的系統看到這筆工作
                      </p>
                    </div>

                    {/* 狀態 */}
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">更新狀態</p>
                      <div className="flex flex-wrap gap-2">
                        {BOOKING_STATUSES.map(s => (
                          <button key={s} onClick={() => patch(b.id, { status: s })}
                            className={`px-3 py-2 min-h-[48px] rounded-xl border-2 text-[15px] font-semibold transition-colors ${b.status === s ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <label className="form-label">內部備註</label>
                      <textarea className="form-input" rows={2} defaultValue={b.admin_note || ''}
                        onBlur={e => { if (e.target.value !== (b.admin_note || '')) patch(b.id, { admin_note: e.target.value }) }}
                        placeholder="例：已提供匯款帳戶、客戶要求女性陪診員…" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
