'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { eventMeta } from '@/lib/careMeta'

interface Props {
  bookingId: number
  status: string
  acceptedAt: string | null
  contactConfirmedAt: string | null
  metAt: string | null
  onChanged: () => void
}

interface Ev {
  id: number; event_type: string; note: string | null
  photos: string[]; created_at: string
}

/** 需要附照片的節點 */
const PHOTO_EVENTS = ['met', 'progress']

export default function JobFlow({ bookingId, status, acceptedAt, contactConfirmedAt, metAt, onChanged }: Props) {
  const [events, setEvents] = useState<Ev[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch(`/api/companion/events?booking_id=${bookingId}`)
      .then(r => r.json()).then(d => { if (d.success) setEvents(d.data) })
      .catch(() => {})
  }, [bookingId])
  useEffect(() => { load() }, [load])

  const reset = () => { setOpen(null); setNote(''); setPhotos([]); setPreviews([]) }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setBusy(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'record')
      const res = await fetch('/api/companion/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (d.success) {
        setPhotos(p => [...p, d.path])
        if (d.preview) setPreviews(p => [...p, d.preview])
      } else toast.error(d.error || '照片上傳失敗')
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const report = async (type: string) => {
    setBusy(true)
    const res = await fetch('/api/companion/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, event_type: type, note, photos }),
    })
    const d = await res.json()
    setBusy(false)
    if (d.success) {
      toast.success('已回報')
      reset(); load(); onChanged()
    } else toast.error(d.error || '回報失敗')
  }

  const has = (t: string) => events.some(e => e.event_type === t)

  // 依目前進度決定可執行的動作
  const actions: { type: string; label: string; primary?: boolean; hint?: string }[] = []
  if (status === '已派工' && !acceptedAt) {
    actions.push({ type: 'accepted', label: '✅ 接受這筆派工', primary: true })
    actions.push({ type: 'declined', label: '🚫 無法接單' })
  } else if (status === '已派工') {
    if (!contactConfirmedAt) {
      actions.push({ type: 'contacted', label: '📞 已電話聯絡家屬確認', primary: true, hint: '請先與家屬確認時間、地點與注意事項' })
    }
    if (!metAt) {
      actions.push({ type: 'met', label: '🤝 已與就診人會合', primary: !!contactConfirmedAt, hint: '請拍一張會合照片作為服務憑證' })
    }
  } else if (status === '服務中') {
    actions.push({ type: 'progress', label: '📸 回報服務進度', primary: true, hint: '例：已完成抽血、正在等候叫號' })
    actions.push({ type: 'doctor_note', label: '🩺 記錄醫師重要提醒', hint: '家屬最重視這項，請盡量完整' })
    actions.push({ type: 'completed', label: '🏁 服務完成' })
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      {/* 進度時間軸 */}
      {events.length > 0 && (
        <div className="mb-4">
          <p className="font-bold text-gray-700 text-[15px] mb-2">服務記錄</p>
          <div className="space-y-2">
            {events.map(ev => {
              const m = eventMeta(ev.event_type)
              return (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 text-[15px]">
                      {m.label}
                      <span className="t-meta font-normal ml-2">
                        {new Date(ev.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                    {ev.note && <p className="t-body mt-0.5 whitespace-pre-wrap">{ev.note}</p>}
                    {Array.isArray(ev.photos) && ev.photos.length > 0 && (
                      <p className="t-meta mt-0.5">📎 已附 {ev.photos.length} 張照片</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 動作按鈕 */}
      {actions.length > 0 && !open && (
        <div className="space-y-2">
          {actions.map(a => (
            <button key={a.type} onClick={() => { setOpen(a.type); setNote('') }}
              className={a.primary ? 'btn-card' : 'btn-card-ghost'}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* 回報表單 */}
      {open && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="font-bold text-gray-800 text-base">{eventMeta(open).icon} {eventMeta(open).label}</p>
          {actions.find(a => a.type === open)?.hint && (
            <p className="t-meta">{actions.find(a => a.type === open)?.hint}</p>
          )}

          <textarea className="form-input" rows={3}
            placeholder={
              open === 'declined' ? '請說明無法接單的原因，方便客服重新安排' :
              open === 'contacted' ? '例：已與王小姐通話確認，明早 9:00 醫院大廳會合，長輩需輪椅' :
              open === 'doctor_note' ? '例：醫師交代血壓藥改為早晚各一次，兩週後回診，若頭暈立即回診' :
              open === 'met' ? '例：已於一樓大廳與陳先生會合，準備前往報到' :
              '請簡短說明目前進度'
            }
            value={note} onChange={e => setNote(e.target.value)} />

          {PHOTO_EVENTS.includes(open) && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={upload} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="btn-card-ghost">
                {busy ? '上傳中…' : `📷 加入照片${photos.length > 0 ? `（已 ${photos.length} 張）` : ''}`}
              </button>
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {previews.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt={`照片 ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              )}
              <p className="t-meta mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                ⚠️ 拍照請取得就診人同意，並<strong>避免拍到其他病患、病歷或檢查報告</strong>。
                照片僅供服務憑證與回報家屬使用。
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={reset} className="btn-card-ghost flex-1">取消</button>
            <button onClick={() => report(open)} disabled={busy} className="btn-card flex-1">
              {busy ? '送出中…' : '確認回報'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
