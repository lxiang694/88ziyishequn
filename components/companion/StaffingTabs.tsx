'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { TW_COUNTIES } from '@/lib/careMeta'
import {
  WEEKDAY_LABELS, DECLINE_LABELS, TIME_OFF_TYPE_LABELS,
  TIME_OFF_STATUS_LABELS, TIME_OFF_REASON_LABELS, CAPABILITY_LABELS,
  labelOf, chipClass,
} from '@/lib/care/staffing/labels'

/**
 * 陪診員端的 Sprint C 分頁。
 *
 * 兼職看到「可服務時段」與「服務邀請」；全職只看到請假。
 * 邀請在接受前只有去敏感化摘要，內容由伺服器決定，前端無法要求更多。
 */

// ── 可服務時段（兼職）────────────────────────────────────────
export function AvailabilityTab() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ weekday: 1, start_time: '09:00', end_time: '12:00', region: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch('/api/companion/availability-rules').then(r => r.json())
      .then(d => { if (d.success) setRules(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    const res = await fetch('/api/companion/availability-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); load()
  }

  const active = rules.filter(r => r.active)

  return (
    <>
      <h2 className="t-section-title mb-1">可服務時段</h2>
      <p className="t-meta mb-4">
        設定每週固定可以接案的時段。這只代表<strong>願意接受邀請</strong>，
        不代表一定會有服務，也不是已排班。
      </p>

      {loading ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">載入中…</div> : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <h3 className="font-bold text-gray-800 text-base mb-3">目前設定</h3>
            {active.length === 0 ? (
              <p className="t-body">尚未設定。沒有設定時段不會影響既有派工，但客服比較難安排新的服務給您。</p>
            ) : (
              <div className="space-y-2">
                {active.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-[15px]">
                        {WEEKDAY_LABELS[r.weekday]} {String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}
                      </p>
                      {r.region && <p className="t-meta">{r.region}</p>}
                    </div>
                    <button disabled={busy}
                      onClick={() => post({ action: 'disable', rule_id: r.id }, '已停用')}
                      className="text-[13px] font-semibold text-red-700 underline min-h-[48px] flex-shrink-0">
                      停用
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-base mb-3">新增時段</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="form-label" htmlFor="wd">星期</label>
                <select id="wd" className="form-input" value={form.weekday}
                  onChange={e => setForm(f => ({ ...f, weekday: Number(e.target.value) }))}>
                  {WEEKDAY_LABELS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="rg">服務區域（選填）</label>
                <select id="rg" className="form-input" value={form.region}
                  onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="">沿用我的服務區</option>
                  {TW_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="st">開始時間</label>
                <input id="st" type="time" className="form-input" value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="form-label" htmlFor="et">結束時間</label>
                <input id="et" type="time" className="form-input" value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <button disabled={busy}
              onClick={() => post({ action: 'create', ...form, region: form.region || undefined }, '已新增時段')}
              className="btn-primary w-full">新增</button>
            <p className="t-meta mt-2">時段不可與已設定的時段重疊。</p>
          </div>
        </>
      )}
    </>
  )
}

// ── 服務邀請（兼職）────────────────────────────────────────
export function ProposalsTab() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [declining, setDeclining] = useState<number | null>(null)
  const [reason, setReason] = useState('schedule_conflict')

  const load = useCallback(() => {
    fetch('/api/companion/proposals').then(r => r.json())
      .then(d => { if (d.success) setRows(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const respond = async (id: number, body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    const res = await fetch(`/api/companion/proposals/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setDeclining(null); load()
  }

  const accept = (id: number) => {
    if (!confirm('確定要接下這筆服務嗎？\n接受後就會成為您的正式工作，取消需聯絡客服。')) return
    respond(id, { action: 'accept' }, '已接下這筆服務')
  }

  return (
    <>
      <h2 className="t-section-title mb-1">服務邀請</h2>
      <p className="t-meta mb-4">
        接受前只會看到日期、區域與需要的能力。
        <strong>接受之後</strong>才會在「工作」看到完整的就診人與聯絡資訊。
      </p>

      {loading ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">載入中…</div>
        : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">
            目前沒有待回覆的邀請。設定「可服務時段」後，客服比較容易安排適合的服務給您。
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(p => (
              <div key={p.proposal_id} className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-5">
                <p className="font-bold text-gray-900 text-lg">{p.service_date}</p>
                <p className="t-body mt-0.5">
                  {p.county || '未指定區域'}
                  {p.service_name ? `・${p.service_name}` : ''}
                </p>
                {p.mobility === 'wheelchair' && (
                  <p className="t-meta mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    這位就診人需要輪椅協助
                  </p>
                )}
                {p.required_capabilities?.length > 0 && (
                  <p className="t-meta mt-2">
                    需要能力：{p.required_capabilities.map((c: string) => labelOf(CAPABILITY_LABELS, c)).join('、')}
                  </p>
                )}
                <p className="t-meta mt-2 text-orange-700 font-semibold">
                  請於 {p.expires_at?.slice(5, 16).replace('T', ' ')} 前回覆
                </p>

                {declining === p.proposal_id ? (
                  <div className="mt-3 space-y-2">
                    <label className="form-label" htmlFor={`dr-${p.proposal_id}`}>婉拒原因</label>
                    <select id={`dr-${p.proposal_id}`} className="form-input" value={reason}
                      onChange={e => setReason(e.target.value)}>
                      {Object.entries(DECLINE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button disabled={busy}
                        onClick={() => respond(p.proposal_id, { action: 'decline', reason_code: reason }, '已婉拒')}
                        className="btn-secondary flex-1">送出婉拒</button>
                      <button onClick={() => setDeclining(null)} className="btn-secondary">返回</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-4">
                    <button disabled={busy} onClick={() => accept(p.proposal_id)} className="btn-primary flex-1">
                      接下這筆
                    </button>
                    <button disabled={busy} onClick={() => setDeclining(p.proposal_id)} className="btn-secondary">
                      婉拒
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  )
}

// ── 請假／暫停接案 ──────────────────────────────────────────
export function TimeOffTab({ employmentType }: { employmentType: string }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const isFullTime = employmentType === 'fulltime' || employmentType === 'full_time'
  const [form, setForm] = useState({
    request_type: isFullTime ? 'leave' : 'unavailable',
    start_date: '', end_date: '', reason_code: 'personal', note: '',
  })

  const load = useCallback(() => {
    fetch('/api/companion/time-off').then(r => r.json())
      .then(d => { if (d.success) setRows(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    const res = await fetch('/api/companion/time-off', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); load()
  }

  return (
    <>
      <h2 className="t-section-title mb-1">{isFullTime ? '請假申請' : '暫停接案'}</h2>
      <p className="t-meta mb-4">
        送出後由客服審核。核准的期間<strong>不會再安排新的服務</strong>；
        該期間如果已經有排定的服務，需要另外聯絡客服處理。
      </p>

      {loading ? <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">載入中…</div> : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <h3 className="font-bold text-gray-800 text-base mb-3">申請紀錄</h3>
            {rows.length === 0 ? <p className="t-body">還沒有申請紀錄。</p> : (
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[13px] font-semibold ${chipClass(r.status)}`}>
                        {labelOf(TIME_OFF_STATUS_LABELS, r.status)}
                      </span>
                      <span className="t-meta">{labelOf(TIME_OFF_TYPE_LABELS, r.request_type)}</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-[15px] mt-1">{r.start_date} ～ {r.end_date}</p>
                    <p className="t-meta">{labelOf(TIME_OFF_REASON_LABELS, r.reason_code)}</p>
                    {r.review_note && <p className="t-meta mt-1">客服回覆：{r.review_note}</p>}
                    {r.status === 'submitted' && (
                      <button disabled={busy}
                        onClick={() => post({ action: 'cancel', request_id: r.id }, '已取消申請')}
                        className="text-[13px] font-semibold text-gray-600 underline mt-2 min-h-[48px]">
                        取消這筆申請
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 text-base mb-3">新增申請</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="form-label" htmlFor="sd">開始日期</label>
                <input id="sd" type="date" className="form-input" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="form-label" htmlFor="ed">結束日期</label>
                <input id="ed" type="date" className="form-input" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <label className="form-label" htmlFor="rc">原因</label>
            <select id="rc" className="form-input mb-3" value={form.reason_code}
              onChange={e => setForm(f => ({ ...f, reason_code: e.target.value }))}>
              {Object.entries(TIME_OFF_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="form-label" htmlFor="tn">補充說明（選填）</label>
            <textarea id="tn" className="form-input mb-3" rows={2} maxLength={200}
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            <button disabled={busy || !form.start_date || !form.end_date}
              onClick={() => post({ action: 'submit', ...form, note: form.note || undefined }, '已送出申請')}
              className="btn-primary w-full disabled:opacity-40">送出申請</button>
          </div>
        </>
      )}
    </>
  )
}
