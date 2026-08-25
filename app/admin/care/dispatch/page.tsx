'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { EMPLOYMENT_LABELS, labelOf } from '@/lib/care/staffing/labels'

interface Booking {
  id: number; booking_no: string; service_date: string; time_slot: string | null
  county: string | null; hospital: string | null; service_name: string | null; status: string
}
interface Candidate {
  companion: { id: number; name: string; phone: string; status: string }
  employmentType: string | null
  regions: string[]
  result: { ok: boolean; failures: string[] }
  failureMessages: string[]
}

export default function CareDispatchPage() {
  const [cases, setCases] = useState<any[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
  const [wantType, setWantType] = useState<'part_time' | 'full_time'>('part_time')
  const [cands, setCands] = useState<Candidate[]>([])
  const [busy, setBusy] = useState(false)
  const [hours, setHours] = useState(24)

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/dispatch').then(r => r.json())
      .then(d => {
        if (d.success) { setCases(d.data.cases); setBookings(d.data.bookings) }
        else setError(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const loadCandidates = useCallback((bookingId: number, type: string) => {
    fetch(`/api/admin/care/dispatch?booking_id=${bookingId}&employment_type=${type}`)
      .then(r => r.json())
      .then(d => { d.success ? setCands(d.data.candidates) : toast.error(d.error || '載入失敗') })
      .catch(() => toast.error('網路錯誤'))
  }, [])

  useEffect(() => { if (picked) loadCandidates(picked, wantType) }, [picked, wantType, loadCandidates])

  const post = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    const res = await fetch('/api/admin/care/dispatch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg)
    load()
    if (picked) loadCandidates(picked, wantType)
    return d
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">🤝 人工媒合</h1>
      <p className="text-gray-600 text-sm mb-4">
        全職可直接指派；<strong>兼職只能發出邀請</strong>，陪診員接受後才成立正式指派。
      </p>

      {loading ? <div className="card p-10 text-center text-gray-600">載入中…</div>
        : error ? (
          <div className="card p-8 text-center">
            <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error}</p>
            <p className="text-gray-700 text-[15px]">
              若提到資料表不存在，請先執行{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 rounded">migrations/care_staffing_schema.sql</code>
            </p>
          </div>
        ) : (
          <>
            {cases.length > 0 && (
              <div className="card p-5 mb-4">
                <h2 className="font-bold text-gray-800 text-base mb-1">待媒合案件</h2>
                <p className="text-gray-600 text-[13px] mb-3">
                  按下「轉為正式服務」會從案件與初評資料建立一筆未指派的服務，之後才能派工。
                </p>
                <div className="space-y-2">
                  {cases.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3">
                      <span className="font-mono font-bold text-gray-800 text-[13px]">{c.case_no}</span>
                      {c.booking_id ? (
                        <span className="text-gray-600 text-[13px]">已轉為服務 #{c.booking_id}</span>
                      ) : (
                        <button disabled={busy}
                          onClick={() => post({ action: 'materialize_case', case_id: c.id }, '已轉為正式服務')}
                          className="btn-secondary">轉為正式服務</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-5 mb-4">
              <h2 className="font-bold text-gray-800 text-base mb-3">未指派的服務（{bookings.length}）</h2>
              {bookings.length === 0 ? (
                <p className="text-gray-600 text-[15px]">目前沒有待派工的服務。</p>
              ) : (
                <div className="space-y-2">
                  {bookings.map(b => (
                    <button key={b.id} onClick={() => setPicked(b.id)}
                      className={`w-full text-left border-2 rounded-xl p-3 ${picked === b.id ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-gray-800 text-[13px]">{b.booking_no}</span>
                        <span className="px-2 py-0.5 rounded-md text-[13px] bg-gray-100 text-gray-700">{b.status}</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-[15px] mt-0.5">
                        {b.service_date}・{b.county} {b.hospital}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {picked && (
              <div className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h2 className="font-bold text-gray-800 text-base">候選陪診員</h2>
                  <div className="flex gap-1.5">
                    {(['part_time', 'full_time'] as const).map(t => (
                      <button key={t} onClick={() => setWantType(t)}
                        className={`px-3 min-h-[48px] rounded-xl text-[15px] font-semibold ${wantType === t ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                        {labelOf(EMPLOYMENT_LABELS, t)}
                      </button>
                    ))}
                  </div>
                </div>

                {wantType === 'part_time' && (
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-gray-700 text-[15px]" htmlFor="h">邀請回覆期限</label>
                    <select id="h" className="form-input max-w-[140px]" value={hours}
                      onChange={e => setHours(Number(e.target.value))}>
                      {[6, 12, 24, 48, 72].map(n => <option key={n} value={n}>{n} 小時</option>)}
                    </select>
                  </div>
                )}

                {cands.length === 0 ? <p className="text-gray-600 text-[15px]">載入中…</p> : (
                  <div className="space-y-2">
                    {cands.map(c => (
                      <div key={c.companion.id}
                        className={`border-2 rounded-xl p-3 ${c.result.ok ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/admin/care/staff/${c.companion.id}`}
                                className="font-bold text-green-700 text-[15px] underline">{c.companion.name}</Link>
                              <span className="px-2 py-0.5 rounded-md text-[13px] bg-gray-100 text-gray-700">
                                {labelOf(EMPLOYMENT_LABELS, c.employmentType)}
                              </span>
                            </div>
                            <p className="text-gray-600 text-[13px] mt-0.5">
                              服務區：{c.regions.length ? c.regions.join('、') : '未設定'}
                            </p>
                            {!c.result.ok && (
                              <p className="text-red-700 text-[13px] mt-1">{c.failureMessages.join('；')}</p>
                            )}
                          </div>

                          {c.result.ok && (
                            wantType === 'full_time' ? (
                              <button disabled={busy}
                                onClick={() => post({ action: 'assign_full_time', booking_id: picked, companion_id: c.companion.id }, '已指派')}
                                className="btn-primary flex-shrink-0">直接指派</button>
                            ) : (
                              <button disabled={busy}
                                onClick={() => post({ action: 'create_proposal', booking_id: picked, companion_id: c.companion.id, expires_in_hours: hours }, '邀請已送出')}
                                className="btn-primary flex-shrink-0">送出邀請</button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
    </div>
  )
}
