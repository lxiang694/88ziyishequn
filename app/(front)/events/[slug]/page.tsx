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

  const [form, setForm] = useState({ name: '', phone: '', topic: '', companions: -1 })
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
    if (form.companions < 0) e.companions = '請選擇是否有親友一起參加'
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

  if (loading) return <div className="py-20 text-center text-gray-600">載入中...</div>
  if (notFound || !event) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-xl text-gray-600">找不到這個活動，或活動已下架</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* ─── HERO HEADER ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-700 via-emerald-600 to-teal-600 px-6 py-9 sm:px-10 sm:py-12 mb-6 text-white shadow-lg shadow-green-200/50">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -left-10 -bottom-12 w-44 h-44 bg-white/5 rounded-full" />
        <div className="relative text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-[13px] font-bold mb-4 tracking-wide">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            線下活動報名
          </div>
          <h1 className="text-2xl sm:text-[2rem] font-extrabold leading-tight tracking-tight mb-1">
            {event.title}
          </h1>
        </div>
      </div>

      {/* ─── EVENT INFO ─── */}
      {(event.event_time || event.address || event.description) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 mb-6 overflow-hidden">
          {event.event_time && (
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-shrink-0 w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-xl">🕒</div>
              <div>
                <p className="text-[13px] text-gray-600 font-medium tracking-wide">活動時間</p>
                <p className="text-gray-800 font-bold text-base leading-relaxed mt-0.5">{event.event_time}</p>
              </div>
            </div>
          )}
          {event.address && (
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-shrink-0 w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-xl">📍</div>
              <div>
                <p className="text-[13px] text-gray-600 font-medium tracking-wide">活動地點</p>
                <p className="text-gray-800 font-bold text-base leading-relaxed mt-0.5">{event.address}</p>
              </div>
            </div>
          )}
          {event.description && (
            <div className="px-5 py-4 bg-gray-50/50">
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>
          )}
        </div>
      )}

      {event.registration_closed ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-10 text-center mb-6">
          <div className="text-5xl mb-4">⏰</div>
          <p className="text-xl font-bold text-gray-700 mb-2">活動報名已結束</p>
          <p className="text-gray-500 leading-relaxed">本場次報名已於活動開始前截止<br />感謝您的關注，歡迎報名其他場次</p>
        </div>
      ) : submitted ? (
        <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm p-10 text-center mb-6">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-xl font-bold text-gray-800 mb-2">報名成功！</p>
          <p className="text-gray-500 leading-relaxed">我們已收到您的報名資料<br />期待在活動現場與您見面</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-7 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-6 bg-green-600 rounded-full" />
            <h2 className="text-lg font-bold text-gray-800">填寫報名資料</h2>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">姓名 <span className="text-red-500">*</span></label>
              <input className={`form-input ${errors.name ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="請輸入您的姓名" value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })) }} />
              {errors.name && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">聯絡電話 <span className="text-red-500">*</span></label>
              <input className={`form-input ${errors.phone ? 'border-red-400 bg-red-50' : ''}`}
                type="tel" inputMode="numeric" placeholder="09xxxxxxxx" value={form.phone}
                onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: '' })) }} />
              {errors.phone && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                本次您最想得到什麼幫助？想討論的話題是什麼？
                <span className="text-gray-600 font-normal ml-1">（選填）</span>
              </label>
              <textarea className="form-input leading-relaxed" rows={4} placeholder="例如：想了解如何改善睡眠、調整飲食習慣、營養補充建議…"
                value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">是否有朋友或家人一起參加？</label>
              <select className={`form-input ${errors.companions ? 'border-red-400 bg-red-50' : ''}`} value={form.companions}
                onChange={e => { setForm(f => ({ ...f, companions: Number(e.target.value) })); setErrors(er => ({ ...er, companions: '' })) }}>
                <option value={-1} disabled>請選擇</option>
                {COMPANION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.companions && <p className="text-red-500 text-sm mt-1.5">⚠️ {errors.companions}</p>}
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full text-lg py-4 mt-6 disabled:opacity-50">
            {submitting ? '送出中...' : '送出報名 →'}
          </button>
          <p className="text-center text-[13px] text-gray-600 mt-3">送出後我們將透過電話或 LINE 與您聯繫活動細節</p>
        </div>
      )}

      {/* ─── ATTENDEE LIST ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-green-600 rounded-full" />
            <h2 className="text-lg font-bold text-gray-800">誰在參加</h2>
          </div>
          <span className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">已有 {total} 人</span>
        </div>
        {registrations.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">目前還沒有人報名，成為第一位吧！</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto -mx-1 px-1">
            {registrations.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center text-green-700 font-bold text-sm">
                    {r.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-sm">{r.name}</span>
                      {r.companions > 0 && <span className="text-[13px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full flex-shrink-0">攜伴 {r.companions} 人</span>}
                    </div>
                    <span className="text-gray-600 font-mono text-[13px]">{r.phone}</span>
                  </div>
                </div>
                <span className="text-gray-300 text-[13px] whitespace-nowrap flex-shrink-0">{formatDateTime(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-center text-[13px] text-gray-300 mt-4">為保護隱私，報名者姓名與電話已部分隱藏</p>
      </div>
    </div>
  )
}
