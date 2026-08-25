'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { TW_COUNTIES } from '@/lib/careMeta'
import {
  EMPLOYMENT_LABELS, EMPLOYMENT_STATUS_LABELS, CAPABILITY_LABELS, VERIFICATION_LABELS,
  TIME_OFF_TYPE_LABELS, TIME_OFF_STATUS_LABELS, WEEKDAY_LABELS, labelOf, chipClass,
} from '@/lib/care/staffing/labels'

export default function StaffDetailPage({ params }: { params: { id: string } }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [term, setTerm] = useState({ employment_type: 'part_time', effective_from: '', note: '' })
  const [region, setRegion] = useState('台北市')
  const [cap, setCap] = useState({ capability_code: 'general_outpatient_flow', expires_at: '' })

  const load = useCallback(() => {
    fetch(`/api/admin/care/staff/${params.id}`).then(r => r.json())
      .then(x => { x.success ? setD(x.data) : setError(x.error || '載入失敗') })
      .catch(() => setError('網路錯誤，請稍後再試'))
  }, [params.id])
  useEffect(() => { load() }, [load])

  const post = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    const res = await fetch(`/api/admin/care/staff/${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const x = await res.json()
    setBusy(false)
    if (!x.success) return toast.error(x.error || '操作失敗')
    toast.success(msg); load()
  }

  if (error) return (
    <div className="max-w-3xl mx-auto card p-8 text-center">
      <p className="text-red-600 font-bold text-lg">⚠️ {error}</p>
      <Link href="/admin/care/staff" className="btn-secondary mt-4 inline-flex">回名冊</Link>
    </div>
  )
  if (!d) return <div className="max-w-3xl mx-auto card p-10 text-center text-gray-600">載入中…</div>

  const active = d.terms.find((t: any) => t.status === 'active')

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/care/staff" className="text-gray-600 text-sm inline-flex min-h-[48px] items-center">← 回名冊</Link>

      <div className="card p-5 mb-4">
        <h1 className="text-lg font-bold text-gray-900">{d.companion.name}</h1>
        <p className="text-gray-600 text-sm mt-0.5">
          {d.companion.phone}｜已完成 {d.companion.completed_count} 場
        </p>
        {d.companion.certifications && (
          <p className="text-gray-600 text-[13px] mt-1">自填證照：{d.companion.certifications}</p>
        )}
      </div>

      {/* 僱用條件 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-2">僱用條件</h2>
        <p className="text-gray-600 text-[13px] mb-3">
          陪診員<strong>不能自行變更</strong>僱用型態。同一時間只能有一筆有效條件。
        </p>

        {d.terms.length === 0 && (
          <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[15px] mb-3">
            尚未設定。沒有僱用條件的陪診員無法被派工或收到邀請。
          </p>
        )}

        {d.terms.map((t: any) => (
          <div key={t.id} className="border border-gray-200 rounded-xl p-3 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900 text-[15px]">{labelOf(EMPLOYMENT_LABELS, t.employment_type)}</span>
              <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(t.status)}`}>
                {labelOf(EMPLOYMENT_STATUS_LABELS, t.status)}
              </span>
              <span className="text-gray-600 text-[13px]">
                {t.effective_from} ～ {t.effective_to || '無結束日'}
              </span>
            </div>
            {t.note && <p className="text-gray-600 text-[13px] mt-1">{t.note}</p>}
            {t.status === 'active' && (
              <div className="flex gap-2 mt-2">
                <button disabled={busy} onClick={() => post({ action: 'pause_employment_term', term_id: t.id }, '已暫停接案')}
                  className="btn-secondary">暫停接案</button>
                <button disabled={busy}
                  onClick={() => post({ action: 'end_employment_term', term_id: t.id, end_date: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) }, '已結束')}
                  className="btn-danger">結束</button>
              </div>
            )}
            {t.status === 'paused' && (
              <button disabled={busy} onClick={() => post({ action: 'resume_employment_term', term_id: t.id }, '已恢復接案')}
                className="btn-primary mt-2">恢復接案</button>
            )}
          </div>
        ))}

        {!active && (
          <div className="space-y-3 mt-3 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="et">僱用型態</label>
                <select id="et" className="form-input" value={term.employment_type}
                  onChange={e => setTerm(t => ({ ...t, employment_type: e.target.value }))}>
                  <option value="part_time">兼職</option>
                  <option value="full_time">全職</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="ef">生效日</label>
                <input id="ef" type="date" className="form-input" value={term.effective_from}
                  onChange={e => setTerm(t => ({ ...t, effective_from: e.target.value }))} />
              </div>
            </div>
            <button disabled={busy || !term.effective_from}
              onClick={() => post({ action: 'create_employment_term', ...term, note: term.note || undefined }, '已建立僱用條件')}
              className="btn-primary disabled:opacity-40">建立僱用條件</button>
          </div>
        )}
      </div>

      {/* 服務區域 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-2">服務區域</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {d.regions.length === 0 && <p className="text-gray-600 text-[15px]">尚未設定，派工時會因區域不符被擋下。</p>}
          {d.regions.map((r: string) => (
            <span key={r} className="inline-flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-[15px]">
              {r}
              <button disabled={busy} onClick={() => post({ action: 'remove_region', region: r }, '已移除')}
                className="text-red-700 font-bold" aria-label={`移除 ${r}`}>×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <select className="form-input" value={region} onChange={e => setRegion(e.target.value)} aria-label="新增服務區域">
            {TW_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button disabled={busy} onClick={() => post({ action: 'add_region', region }, '已新增')}
            className="btn-secondary flex-shrink-0">新增</button>
        </div>
      </div>

      {/* 能力驗證 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-1">能力驗證</h2>
        <p className="text-gray-600 text-[13px] mb-3">
          ⚠️ 這些<strong>不是醫療執照也不是醫療資格</strong>，不得用於宣稱醫療專業。
          陪診員無法自行標記為已驗證。
        </p>

        {d.verifications.length === 0 && <p className="text-gray-600 text-[15px] mb-3">尚未驗證任何能力。</p>}
        {d.verifications.map((v: any) => (
          <div key={v.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3 mb-2">
            <div>
              <p className="font-semibold text-gray-900 text-[15px]">{labelOf(CAPABILITY_LABELS, v.capability_code)}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(v.status)}`}>
                  {labelOf(VERIFICATION_LABELS, v.status)}
                </span>
                <span className="text-gray-600 text-[13px]">
                  {v.expires_at ? `有效至 ${v.expires_at}` : '無期限'}
                </span>
              </div>
            </div>
            {v.status === 'verified' && (
              <button disabled={busy}
                onClick={() => post({ action: 'suspend_capability', capability_code: v.capability_code }, '已暫停')}
                className="text-[13px] font-semibold text-red-700 underline min-h-[48px] flex-shrink-0">暫停</button>
            )}
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 mt-3 border-t border-gray-100 pt-3">
          <div>
            <label className="form-label" htmlFor="cc">能力項目</label>
            <select id="cc" className="form-input" value={cap.capability_code}
              onChange={e => setCap(c => ({ ...c, capability_code: e.target.value }))}>
              {Object.entries(CAPABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="ce">有效期限（選填）</label>
            <input id="ce" type="date" className="form-input" value={cap.expires_at}
              onChange={e => setCap(c => ({ ...c, expires_at: e.target.value }))} />
          </div>
        </div>
        <button disabled={busy}
          onClick={() => post({ action: 'verify_capability', ...cap, expires_at: cap.expires_at || undefined }, '已驗證')}
          className="btn-primary mt-3">標記為已驗證</button>
      </div>

      {/* 可服務時段 */}
      <div className="card p-5 mb-4">
        <h2 className="font-bold text-gray-800 text-base mb-2">可服務時段</h2>
        <p className="text-gray-600 text-[13px] mb-3">由陪診員本人設定，後台唯讀。</p>
        {d.rules.filter((r: any) => r.active).length === 0 ? (
          <p className="text-gray-600 text-[15px]">尚未設定週期性時段。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {d.rules.filter((r: any) => r.active).map((r: any) => (
              <span key={r.id} className="bg-gray-100 rounded-lg px-3 py-1.5 text-[15px]">
                {WEEKDAY_LABELS[r.weekday]} {r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 請假 */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-800 text-base mb-2">請假／暫停接案</h2>
        {d.timeOff.length === 0 ? <p className="text-gray-600 text-[15px]">沒有紀錄。</p> : (
          <div className="space-y-2">
            {d.timeOff.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(t.status)}`}>
                  {labelOf(TIME_OFF_STATUS_LABELS, t.status)}
                </span>
                <span className="text-gray-800 text-[15px]">
                  {labelOf(TIME_OFF_TYPE_LABELS, t.request_type)}・{t.start_date} ～ {t.end_date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
