'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatDateTime, validateTWPhone } from '@/lib/utils'
import toast from 'react-hot-toast'

const COMPANION_OPTIONS = [
  { value: 0, label: '無' },
  { value: 1, label: '1人' },
  { value: 2, label: '2人' },
  { value: 3, label: '3人' },
  { value: 4, label: '4人' },
  { value: 5, label: '5人' },
]

export default function EventRegistrationPage() {
  const params = useParams()
  const slug = params.slug as string

  const [event, setEvent] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({ name: '', phone: '', topic: '', companions: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loadRegistrations = useCallback(() => {
    fetch(`/api/events/${slug}/registrations`).then(r => r.json()).then(d => {
      if (d.success) { setRegistrations(d.data); setTotal(d.total) }
    })
  }, [slug])

  useEffect(() => {
    fetch(`/api/events/${slug}`).then(r => r.json()).then(d => {
      if (d.success) setEvent(d.data)
      else setNotFound(true)
      setLoading(false)
    })
    loadRegistrations()
  }, [slug, loadRegistrations])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '請填寫姓名'
    if (!form.phone || !validateTWPhone(form.phone)) e.phone = '請填寫正確手機號碼（09xxxxxxxx）'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { toast.error('請確認填寫資料'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/events/${slug}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.success) {
        toast.success('報名成功！期待與您見面')
        setSubmitted(true)
        loadRegistrations()
      } else {
        toast.error(d.error || '報名失敗，請稍後再試')
      }
    } catch {
      toast.error('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">載入中...</div>
  if (notFound || !event) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-xl text-gray-600">找不到這個活動，或活動已下架</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">{event.title}</h1>
        <div className="inline-flex flex-col gap-1.5 text-left bg-green-50 border border-green-100 rounded-2xl px-5 py-4">
          {event.event_time && (
            <p className="text-gray-700 text-sm flex items-start gap-2"><span>🕒</span><span className="font-semibold">{event.event_time}</span></p>
          )}
          {event.address && (
            <p className="text-gray-700 text-sm flex items-start gap-2"><span>📍</span><span className="font-semibold">{event.address}</span></p>
          )}
        </div>
        {event.description && (
          <p className="text-gray-500 text-sm mt-4 leading-relaxed whitespace-pre-line">{event.description}</p>
        )}
      </div>

      {submitted ? (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-lg font-bold text-gray-800 mb-1">報名成功！</p>
          <p className="text-gray-500 text-sm">我們已收到您的報名資料，期待與您見面</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 mb-8 space-y-4">
          <div>
            <label className="form-label">姓名 <span className="text-red-500">*</span></label>
            <input className={`form-input ${errors.name ? 'border-red-400 bg-red-50' : ''}`}
              placeholder="請輸入您的姓名" value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })) }} />
            {errors.name && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.name}</p>}
          </div>
          <div>
            <label className="form-label">聯絡電話 <span className="text-red-500">*</span></label>
            <input className={`form-input ${errors.phone ? 'border-red-400 bg-red-50' : ''}`}
              type="tel" inputMode="numeric" placeholder="09xxxxxxxx" value={form.phone}
              onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })) }} />
            {errors.phone && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.phone}</p>}
          </div>
          <div>
            <label className="form-label">本次您最想得到什麼幫助？想討論的話題是什麼？ <span className="text-gray-400 font-normal text-sm">（選填）</span></label>
            <textarea className="form-input" rows={3} placeholder="請自由填寫..."
              value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">是否有朋友或家人一起參加？</label>
            <select className="form-input" value={form.companions}
              onChange={e => setForm(f => ({ ...f, companions: Number(e.target.value) }))}>
              {COMPANION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full text-lg py-3.5 disabled:opacity-50">
            {submitting ? '送出中...' : '送出報名'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">👥 目前已有 {total} 人報名</h2>
        {registrations.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">目前還沒有人報名，成為第一位吧！</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {registrations.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">{r.name}</span>
                  <span className="text-gray-400 font-mono">{r.phone}</span>
                  {r.companions > 0 && <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">+{r.companions}人</span>}
                </div>
                <span className="text-gray-300 text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
