'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import { TIME_SLOTS, MOBILITY_OPTIONS, ADDON_OPTIONS, labelOf, statusColor } from '@/lib/careMeta'

interface Me { id: number; name: string; phone: string; employment_type: string; completed_count: number; service_areas: string[] }
interface Avail { id: number; date: string; time_slot: string }
interface Job {
  id: number; booking_no: string; service_name: string; service_date: string; time_slot: string
  county: string; hospital: string; department: string; patient_name: string; patient_gender: string
  patient_age: string; mobility: string; addons: string[]; notes: string; status: string
  contact_name: string; contact_phone: string; price: number
}

// 產生未來 14 天
function next14Days() {
  const out: { date: string; label: string; weekday: string }[] = []
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const wd = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    out.push({ date: iso, label: iso.slice(5).replace('-', '/'), weekday: wd[d.getUTCDay()] })
  }
  return out
}

export default function CompanionDashboard() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [checked, setChecked] = useState(false)
  const [tab, setTab] = useState<'jobs' | 'schedule'>('jobs')
  const [avail, setAvail] = useState<Avail[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const days = next14Days()

  useEffect(() => {
    fetch('/api/companion/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success) setMe(d.data)
        else router.replace('/companion/login')
        setChecked(true)
      })
      .catch(() => { router.replace('/companion/login'); setChecked(true) })
  }, [router])

  const loadAvail = useCallback(() => {
    fetch('/api/companion/availability').then(r => r.json()).then(d => { if (d.success) setAvail(d.data) })
  }, [])
  const loadJobs = useCallback(() => {
    fetch('/api/companion/assignments').then(r => r.json()).then(d => { if (d.success) setJobs(d.data) })
  }, [])

  useEffect(() => { if (me) { loadAvail(); loadJobs() } }, [me, loadAvail, loadJobs])

  const has = (date: string, slot: string) => avail.some(a => a.date === date && a.time_slot === slot)

  const toggle = async (date: string, slot: string) => {
    const enabled = !has(date, slot)
    // 先樂觀更新，失敗再還原
    setAvail(prev => enabled
      ? [...prev, { id: -1, date, time_slot: slot }]
      : prev.filter(a => !(a.date === date && a.time_slot === slot)))
    const res = await fetch('/api/companion/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time_slot: slot, enabled }),
    })
    const d = await res.json()
    if (!d.success) { toast.error(d.error || '設定失敗'); loadAvail() }
  }

  const updateJob = async (id: number, action: 'start' | 'finish') => {
    const res = await fetch('/api/companion/assignments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    const d = await res.json()
    if (d.success) { toast.success(action === 'start' ? '已開始服務' : '服務已完成，辛苦了！'); loadJobs() }
    else toast.error(d.error || '更新失敗')
  }

  const logout = async () => {
    await fetch('/api/companion/auth/me', { method: 'DELETE' })
    router.push('/companion/login')
  }

  if (!checked) return <div className="min-h-screen flex items-center justify-center text-gray-600">載入中…</div>
  if (!me) return null

  const upcoming = jobs.filter(j => j.status !== '已完成')
  const history = jobs.filter(j => j.status === '已完成')

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-green-700 text-white px-4 py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-lg leading-tight truncate">{me.name}</p>
            <p className="text-green-100 text-[13px] mt-0.5">
              {me.employment_type === 'fulltime' ? '全職' : '兼職'}陪診員 · 已完成 {me.completed_count} 場
            </p>
          </div>
          <button onClick={logout} className="text-green-50 text-[15px] font-semibold underline min-h-[48px] px-2 flex-shrink-0">
            登出
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 gap-2 mb-5">
          {([['jobs', '📋 我的工作'], ['schedule', '📅 我的班表']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`min-h-[48px] rounded-xl font-bold text-base border-2 transition-colors ${tab === k ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 工作列表 */}
        {tab === 'jobs' && (
          <>
            <h2 className="t-section-title mb-3">待服務 / 進行中（{upcoming.length}）</h2>
            {upcoming.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">
                目前沒有派工。請到「我的班表」設定可服務時段，客服會依此安排。
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map(j => (
                  <div key={j.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-lg">{j.service_date}</p>
                        <p className="t-price-note">{labelOf(TIME_SLOTS, j.time_slot)}</p>
                      </div>
                      <span className={'status-badge ' + statusColor(j.status)}>{j.status}</span>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <p className="t-body"><strong>🏥 醫院：</strong>{j.county} {j.hospital} {j.department}</p>
                      <p className="t-body">
                        <strong>👤 就診人：</strong>{j.patient_name}
                        {j.patient_age && `・${j.patient_age} 歲`}
                        {j.patient_gender === 'female' ? '・女' : j.patient_gender === 'male' ? '・男' : ''}
                      </p>
                      <p className="t-body"><strong>🚶 行動能力：</strong>{labelOf(MOBILITY_OPTIONS, j.mobility)}</p>
                      <p className="t-body"><strong>📋 方案：</strong>{j.service_name}</p>
                      {Array.isArray(j.addons) && j.addons.length > 0 && (
                        <p className="t-body"><strong>➕ 加購：</strong>{j.addons.map(a => labelOf(ADDON_OPTIONS, a)).join('、')}</p>
                      )}
                      {j.notes && (
                        <p className="t-body bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                          <strong>⚠️ 特殊需求：</strong>{j.notes}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-3 mb-3">
                      <p className="t-meta">家屬聯絡人</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="t-body font-semibold">{j.contact_name}</p>
                        <a href={`tel:${j.contact_phone}`}
                          className="text-green-700 font-bold text-base underline min-h-[48px] flex items-center">
                          📞 {j.contact_phone}
                        </a>
                      </div>
                    </div>

                    {j.status === '已派工' && (
                      <button onClick={() => updateJob(j.id, 'start')} className="btn-card">開始服務</button>
                    )}
                    {j.status === '服務中' && (
                      <button onClick={() => updateJob(j.id, 'finish')} className="btn-card">完成服務</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {history.length > 0 && (
              <>
                <h2 className="t-section-title mt-8 mb-3">已完成（{history.length}）</h2>
                <div className="space-y-2">
                  {history.map(j => (
                    <div key={j.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-[15px]">{j.service_date}・{j.hospital}</p>
                        <p className="t-meta">{j.service_name}</p>
                      </div>
                      <span className={'status-badge flex-shrink-0 ' + statusColor(j.status)}>{j.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* 班表 */}
        {tab === 'schedule' && (
          <>
            <h2 className="t-section-title mb-1">設定可服務時段</h2>
            <p className="t-meta mb-4">
              點選您有空的時段，客服派工時只會安排在您勾選的時間。可隨時調整。
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {days.map(d => (
                <div key={d.date} className="border-b border-gray-100 last:border-0 p-4">
                  <p className="font-bold text-gray-800 text-base mb-2">
                    {d.label}（週{d.weekday}）
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map(s => {
                      const on = has(d.date, s.value)
                      return (
                        <button key={s.value} onClick={() => toggle(d.date, s.value)}
                          className={`min-h-[48px] rounded-xl border-2 text-[15px] font-semibold transition-colors px-2 ${on ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                          {s.label.split('（')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: '16px', fontWeight: '600' } }} />
    </div>
  )
}
