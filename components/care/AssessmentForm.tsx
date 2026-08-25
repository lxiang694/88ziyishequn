'use client'
import { useState, useEffect, useId } from 'react'
import Link from 'next/link'
import { TW_COUNTIES } from '@/lib/careMeta'
import { CARE_SCENARIOS, CARE_CTA, isCareScenario, careScenarioLabel } from '@/lib/careBrand'

/**
 * 需求初步評估表單。
 *
 * Sprint B 起送到 POST /api/care/intake（陪診初評專用端點）。
 * 刻意不呼叫 /api/care/bookings —— 那支會直接建立正式預約單，
 * 與畫面上「尚未成立預約」的告知不符。
 *
 * 送出的欄位由伺服器端 parsePublicIntake() 白名單過濾；
 * 回應只有 { success: true }，不含任何 internal id。
 */

// value 直接使用 API 的 code，避免多一層對應表出錯
const MOBILITY = [
  { value: 'independent', label: '可自行行走' },
  { value: 'assistive_device', label: '使用助行器' },
  { value: 'wheelchair', label: '需輪椅' },
  { value: 'manual_review_required', label: '需先由專人確認' },
]

const TRANSPORT = [
  { value: 'no', label: '不需要' },
  { value: 'yes', label: '需要' },
  { value: 'unsure', label: '想先討論' },
]

const NOTE_MAX = 200
const STEPS = ['就醫情境', '就醫資訊', '聯絡方式'] as const

interface FormState {
  scenario: string
  serviceDate: string
  county: string
  hospital: string
  mobility: string
  transport: string
  contactName: string
  contactPhone: string
  contactLine: string
  relation: string
  note: string
}

const EMPTY: FormState = {
  scenario: '', serviceDate: '', county: '', hospital: '',
  mobility: 'independent', transport: 'no',
  contactName: '', contactPhone: '', contactLine: '', relation: '', note: '',
}

export default function AssessmentForm() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const uid = useId()

  // 首頁分流卡片帶進來的情境；一律用白名單驗證，不直接信任網址參數
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('scenario')
    if (isCareScenario(raw)) setForm(f => ({ ...f, scenario: raw }))
  }, [])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => (e[k] ? { ...e, [k]: '' } : e))
  }

  const fieldId = (k: string) => `${uid}-${k}`
  const errId = (k: string) => `${uid}-${k}-err`

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!form.scenario) e.scenario = '請選擇最接近的就醫情境'
    }
    if (s === 1) {
      if (!form.serviceDate) e.serviceDate = '請選擇預計就醫日期'
      if (!form.county) e.county = '請選擇縣市'
      if (!form.hospital.trim()) e.hospital = '請填寫醫院或診所名稱'
    }
    if (s === 2) {
      if (!form.contactName.trim()) e.contactName = '請填寫聯絡人姓名'
      if (!/^09\d{8}$/.test(form.contactPhone.trim())) e.contactPhone = '請填寫正確的手機號碼，格式為 09 開頭共 10 碼'
      if (!form.relation.trim()) e.relation = '請填寫與就診人的關係'
    }
    return e
  }

  const next = () => {
    const e = validateStep(step)
    setErrors(e)
    if (Object.keys(e).length > 0) {
      document.getElementById(fieldId(Object.keys(e)[0]))?.focus()
      return
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const submit = async () => {
    const e = validateStep(2)
    setErrors(e)
    if (Object.keys(e).length > 0) {
      document.getElementById(fieldId(Object.keys(e)[0]))?.focus()
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/care/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 只送必要欄位；不送任何識別碼、狀態或裝置資訊
        body: JSON.stringify({
          service_scenario: form.scenario,
          mobility_support_level: form.mobility,
          transport_support_requested: form.transport === 'yes',
          hospital_name: form.hospital.trim(),
          county: form.county,
          scheduled_service_date: form.serviceDate,
          time_preference: 'unspecified',
          contact_name: form.contactName.trim(),
          contact_phone: form.contactPhone.trim(),
          contact_line_id: form.contactLine.trim() || undefined,
          contact_preference: form.contactLine.trim() ? 'line' : 'phone',
          relationship_to_beneficiary: form.relation.trim(),
          limited_support_note: form.note.trim() || undefined,
        }),
      })
      const d = await res.json()
      if (!d.success) {
        setSubmitError(d.error || '送出失敗，請稍後再試')
        return
      }
      setDone(true)
    } catch {
      setSubmitError('網路連線有問題，請稍後再試，或直接以 LINE 與我們聯繫')
    } finally {
      setSubmitting(false)
    }
  }

  const Err = ({ k }: { k: string }) =>
    errors[k] ? (
      <p id={errId(k)} role="alert" className="text-red-700 text-[13px] font-semibold mt-1">
        {errors[k]}
      </p>
    ) : null

  const inputCls = (k: string) =>
    `w-full min-h-[48px] rounded-xl border-2 px-3 py-2 text-base text-slate-900 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
      errors[k] ? 'border-red-400' : 'border-slate-200 focus:border-emerald-600'
    }`

  const labelCls = 'block font-semibold text-slate-900 text-[15px] mb-1.5'

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">已收到初步需求</h2>
          <p className="text-slate-700 text-base leading-relaxed">
            將由專人與您聯繫，確認服務適配性、陪診員安排與完整費用。
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-4">
          <p className="font-bold text-slate-900 text-base mb-2">接下來</p>
          <ol className="space-y-2 text-slate-700 text-[15px] leading-relaxed list-decimal list-inside">
            <li>專人會依您填寫的聯絡方式與您確認細節。</li>
            <li>確認可服務並談妥完整費用後，才會進入正式預約程序。</li>
            <li>目前這筆資料<strong>尚未成立預約</strong>，也不代表任何醫療或院方服務承諾。</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
            className="flex-1 min-h-[48px] flex items-center justify-center rounded-xl border-2 border-emerald-700 text-emerald-800 font-bold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            {CARE_CTA.secondary.label}
          </a>
          <Link href="/care"
            className="flex-1 min-h-[48px] flex items-center justify-center rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            回服務首頁
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-8">
      {/* 進度 */}
      <ol className="flex items-center gap-2 mb-6" aria-label="表單進度">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-emerald-700' : 'bg-slate-200'}`} />
            <p className={`text-[13px] mt-1.5 font-semibold ${i <= step ? 'text-emerald-800' : 'text-slate-500'}`}>
              {i + 1}. {s}
              {i === step && <span className="sr-only">（目前步驟）</span>}
            </p>
          </li>
        ))}
      </ol>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        {/* 步驟 1：情境 */}
        {step === 0 && (
          <fieldset>
            <legend className={labelCls}>
              最接近的就醫情境 <span className="text-red-700">（必填）</span>
            </legend>
            <div className="space-y-2" role="radiogroup"
              aria-describedby={errors.scenario ? errId('scenario') : undefined}>
              {CARE_SCENARIOS.map((s, i) => (
                <label key={s.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer min-h-[48px] transition-colors ${
                    form.scenario === s.value ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'
                  }`}>
                  <input
                    id={i === 0 ? fieldId('scenario') : undefined}
                    type="radio" name="scenario" value={s.value}
                    checked={form.scenario === s.value}
                    onChange={() => set('scenario', s.value)}
                    className="w-5 h-5 mt-0.5 accent-emerald-700 flex-shrink-0" />
                  <span>
                    <span className="block font-semibold text-slate-900 text-[15px]">{s.label}</span>
                    <span className="block text-slate-600 text-[13px] mt-0.5">{s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <Err k="scenario" />
          </fieldset>
        )}

        {/* 步驟 2：就醫資訊 */}
        {step === 1 && (
          <>
            {form.scenario && (
              <p className="text-slate-600 text-[13px]">
                已選情境：<strong className="text-slate-800">{careScenarioLabel(form.scenario)}</strong>
              </p>
            )}
            <div>
              <label htmlFor={fieldId('serviceDate')} className={labelCls}>
                預計就醫日期 <span className="text-red-700">（必填）</span>
              </label>
              <input id={fieldId('serviceDate')} type="date" className={inputCls('serviceDate')}
                aria-invalid={!!errors.serviceDate}
                aria-describedby={errors.serviceDate ? errId('serviceDate') : undefined}
                value={form.serviceDate} onChange={e => set('serviceDate', e.target.value)} />
              <Err k="serviceDate" />
            </div>

            <div>
              <label htmlFor={fieldId('county')} className={labelCls}>
                縣市 <span className="text-red-700">（必填）</span>
              </label>
              <select id={fieldId('county')} className={inputCls('county')}
                aria-invalid={!!errors.county}
                aria-describedby={errors.county ? errId('county') : undefined}
                value={form.county} onChange={e => set('county', e.target.value)}>
                <option value="">請選擇縣市</option>
                {TW_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Err k="county" />
            </div>

            <div>
              <label htmlFor={fieldId('hospital')} className={labelCls}>
                醫院／診所名稱 <span className="text-red-700">（必填）</span>
              </label>
              <input id={fieldId('hospital')} className={inputCls('hospital')}
                placeholder="例：台大醫院、林口長庚"
                aria-invalid={!!errors.hospital}
                aria-describedby={errors.hospital ? errId('hospital') : undefined}
                value={form.hospital} onChange={e => set('hospital', e.target.value)} />
              <Err k="hospital" />
            </div>

            <fieldset>
              <legend className={labelCls}>行動協助</legend>
              <div className="grid grid-cols-2 gap-2">
                {MOBILITY.map(m => (
                  <label key={m.value}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer min-h-[48px] ${
                      form.mobility === m.value ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
                    }`}>
                    <input type="radio" name="mobility" value={m.value}
                      checked={form.mobility === m.value}
                      onChange={() => set('mobility', m.value)}
                      className="w-5 h-5 accent-emerald-700 flex-shrink-0" />
                    <span className="text-slate-800 text-[15px] font-semibold">{m.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={labelCls}>是否需要交通協助</legend>
              <div className="grid grid-cols-3 gap-2">
                {TRANSPORT.map(t => (
                  <label key={t.value}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer min-h-[48px] ${
                      form.transport === t.value ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
                    }`}>
                    <input type="radio" name="transport" value={t.value}
                      checked={form.transport === t.value}
                      onChange={() => set('transport', t.value)}
                      className="w-5 h-5 accent-emerald-700 flex-shrink-0" />
                    <span className="text-slate-800 text-[15px] font-semibold">{t.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-slate-600 text-[13px] mt-1.5">交通方式與費用由專人另行確認。</p>
            </fieldset>
          </>
        )}

        {/* 步驟 3：聯絡方式 */}
        {step === 2 && (
          <>
            <div>
              <label htmlFor={fieldId('contactName')} className={labelCls}>
                聯絡人姓名 <span className="text-red-700">（必填）</span>
              </label>
              <input id={fieldId('contactName')} className={inputCls('contactName')}
                autoComplete="name"
                aria-invalid={!!errors.contactName}
                aria-describedby={errors.contactName ? errId('contactName') : undefined}
                value={form.contactName} onChange={e => set('contactName', e.target.value)} />
              <Err k="contactName" />
            </div>

            <div>
              <label htmlFor={fieldId('contactPhone')} className={labelCls}>
                手機號碼 <span className="text-red-700">（必填）</span>
              </label>
              <input id={fieldId('contactPhone')} type="tel" inputMode="numeric" autoComplete="tel"
                className={inputCls('contactPhone')} placeholder="09xxxxxxxx"
                aria-invalid={!!errors.contactPhone}
                aria-describedby={errors.contactPhone ? errId('contactPhone') : undefined}
                value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
              <Err k="contactPhone" />
            </div>

            <div>
              <label htmlFor={fieldId('contactLine')} className={labelCls}>
                LINE ID <span className="text-slate-500 font-normal">（選填）</span>
              </label>
              <input id={fieldId('contactLine')} className={inputCls('contactLine')}
                value={form.contactLine} onChange={e => set('contactLine', e.target.value)} />
            </div>

            <div>
              <label htmlFor={fieldId('relation')} className={labelCls}>
                與就診人的關係 <span className="text-red-700">（必填）</span>
              </label>
              <input id={fieldId('relation')} className={inputCls('relation')} placeholder="例：子女、配偶、本人"
                aria-invalid={!!errors.relation}
                aria-describedby={errors.relation ? errId('relation') : undefined}
                value={form.relation} onChange={e => set('relation', e.target.value)} />
              <Err k="relation" />
            </div>

            <div>
              <label htmlFor={fieldId('note')} className={labelCls}>
                補充需求 <span className="text-slate-500 font-normal">（選填）</span>
              </label>
              <textarea id={fieldId('note')} rows={3} maxLength={NOTE_MAX}
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-base text-slate-900 focus:border-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                placeholder="例：長輩重聽需大聲說話、希望回報給兩位家屬"
                aria-describedby={fieldId('note-help')}
                value={form.note} onChange={e => set('note', e.target.value.slice(0, NOTE_MAX))} />
              <p id={fieldId('note-help')} className="text-slate-600 text-[13px] mt-1">
                僅需填寫與當天流程協助相關的事項，請勿填寫病歷、診斷或用藥內容。
                （{form.note.length} / {NOTE_MAX} 字）
              </p>
            </div>
          </>
        )}
      </div>

      {/* 告知 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-4">
        <p className="text-slate-700 text-[15px] leading-relaxed">
          送出後由專人確認服務適配性、陪診員安排與完整費用；此時尚未成立預約，
          也不代表任何醫療或院方服務承諾。
        </p>
      </div>

      {submitError && (
        <p role="alert" className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-800 text-[15px] font-semibold">
          {submitError}
        </p>
      )}

      {/* 步驟操作 */}
      <div className="flex gap-3 mt-5">
        {step > 0 && (
          <button type="button" onClick={() => setStep(s => s - 1)}
            className="min-h-[48px] px-5 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            上一步
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next}
            className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 text-white font-bold text-base hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            下一步
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting}
            className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 text-white font-bold text-base hover:bg-emerald-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            {submitting ? '送出中…' : '送出需求評估'}
          </button>
        )}
      </div>
    </div>
  )
}
