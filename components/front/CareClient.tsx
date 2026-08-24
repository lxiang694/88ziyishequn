'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import { TW_COUNTIES, TIME_SLOTS, MOBILITY_OPTIONS, ADDON_OPTIONS } from '@/lib/careMeta'

interface Service {
  id: number
  code: string
  name: string
  hours_label: string | null
  price: number
  member_price: number | null
  summary: string | null
  suitable: string | null
  features: string[] | null
}

const PAIN_POINTS = [
  { icon: '🏥', t: '醫院動線複雜', d: '掛號、報到、檢查室、批價、領藥分散在不同樓層，長輩一個人容易走錯、漏做檢查' },
  { icon: '🗣️', t: '看診講不清楚', d: '看診時間短，長輩緊張講不完症狀，回家後又想不起醫師交代什麼' },
  { icon: '💊', t: '用藥搞不清楚', d: '領了藥卻不確定怎麼吃、吃多久、和原本的藥會不會衝突' },
  { icon: '📞', t: '子女在外地', d: '請假回來陪一次要一整天，臨時回診根本來不及' },
]

const FLOW = [
  { n: 1, t: '線上送出預約', d: '選擇方案、填寫就診資訊，1 分鐘完成' },
  { n: 2, t: '客服確認', d: '我們以 LINE 或電話與您確認時段與細節' },
  { n: 3, t: '完成匯款', d: '確認後提供匯款帳戶，收款後正式成立' },
  { n: 4, t: '派工並提供陪診員資料', d: '服務前告知陪診員姓名與聯絡方式' },
  { n: 5, t: '當日陪診＋回報家屬', d: '全程陪同，服務中與結束後回報進度' },
]

export default function CareClient({ services }: { services: Service[] }) {
  const formRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string>(services[0]?.code || '')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ booking_no: string; service_name: string; price: number } | null>(null)
  const [form, setForm] = useState({
    patient_name: '', patient_age: '', patient_gender: '', mobility: 'walk',
    contact_name: '', contact_phone: '', contact_line: '', relation: '',
    service_date: '', time_slot: 'morning', county: '', hospital: '', department: '',
    notes: '',
  })
  const [addons, setAddons] = useState<string[]>([])

  const pick = (code: string) => {
    setSelected(code)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const toggleAddon = (v: string) =>
    setAddons(a => (a.includes(v) ? a.filter(x => x !== v) : [...a, v]))

  const submit = async () => {
    if (!selected) return toast.error('請先選擇陪診方案')
    if (!form.patient_name.trim()) return toast.error('請填寫就診人姓名')
    if (!form.contact_name.trim()) return toast.error('請填寫聯絡人姓名')
    if (!/^09\d{8}$/.test(form.contact_phone.trim())) return toast.error('請填寫正確手機號碼（09xxxxxxxx）')
    if (!form.service_date) return toast.error('請選擇就診日期')

    setSubmitting(true)
    try {
      const res = await fetch('/api/care/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, service_code: selected, addons }),
      })
      const d = await res.json()
      if (d.success) setDone(d.data)
      else toast.error(d.error || '預約失敗，請稍後再試')
    } catch {
      toast.error('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  // 送出成功畫面
  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-14 sm:pt-8 pb-16">
        <div className="text-center mb-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">預約已送出！</h1>
          <p className="t-body">我們會盡快與您聯絡確認</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-5 mb-5 text-center">
          <p className="text-[15px] text-green-800 font-bold mb-2">📋 您的預約編號</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-900 font-mono tracking-wider mb-2 select-all">{done.booking_no}</p>
          <p className="t-meta text-green-800">請截圖保存，與客服聯絡時提供更快</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
          <p className="font-bold text-amber-900 mb-2 text-base">接下來的流程</p>
          <ol className="space-y-2">
            <li className="t-body text-amber-900">1. 客服會在 <strong>1 個工作日內</strong>透過 LINE 或電話與您確認時段與細節</li>
            <li className="t-body text-amber-900">2. 確認無誤後，我們會提供<strong>匯款帳戶</strong></li>
            <li className="t-body text-amber-900">3. 收到款項後預約正式成立，並於服務前告知陪診員資料</li>
          </ol>
          <p className="t-meta mt-3">方案：{done.service_name}｜費用：{formatPrice(done.price)}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a href="https://line.me/ti/p/yw13134" target="_blank" rel="noopener noreferrer"
            className="flex-1 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 rounded-xl text-center min-h-[48px] flex items-center justify-center">
            加 LINE 聯絡客服
          </a>
          <Link href="/" className="flex-1 btn-secondary text-center">回首頁</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-14 sm:pt-8 pb-16">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-green-700 to-emerald-600 text-white p-6 sm:p-8 mb-6">
        <p className="text-green-50 font-semibold mb-2 text-[15px]">健康優選 · 陪診服務</p>
        <h1 className="text-2xl sm:text-3xl font-bold leading-relaxed mb-3">
          一個人跑醫院，<br className="sm:hidden" />不用再自己撐
        </h1>
        <p className="text-green-50 leading-relaxed text-base">
          專業陪診員全程陪同掛號、看診、檢查、領藥，把醫師交代的重點記下來，
          並即時回報家屬。長輩安心，子女不用請假。
        </p>
        <button onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="mt-5 bg-white text-green-800 font-bold px-6 py-3 rounded-xl min-h-[48px] hover:bg-green-50 transition-colors">
          立即預約陪診 →
        </button>
      </section>

      {/* 痛點 */}
      <section className="mb-8">
        <h2 className="t-section-title mb-4">這些情況，我們都遇過</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PAIN_POINTS.map(p => (
            <div key={p.t} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{p.icon}</span>
                <div>
                  <p className="font-bold text-gray-800 text-base mb-1">{p.t}</p>
                  <p className="t-meta leading-relaxed">{p.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 方案 */}
      <section className="mb-8">
        <h2 className="t-section-title mb-1">選擇適合的陪診方案</h2>
        <p className="t-meta mb-4">費用已含陪診員服務費；交通、掛號費、醫療費用另計</p>

        {services.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 t-body text-amber-900">
            方案資料尚未建立，請先於 Supabase 執行 <code>migrations/companion_care_schema.sql</code>。
          </div>
        ) : (
          <div className="space-y-3">
            {services.map(s => {
              const active = selected === s.code
              return (
                <div key={s.code}
                  className={`rounded-2xl border-2 p-5 transition-all ${active ? 'border-green-600 bg-green-50/50 shadow-md' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg leading-snug">{s.name}</h3>
                      {s.hours_label && <p className="t-price-note mt-0.5">{s.hours_label}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="t-price">{formatPrice(s.price)}</div>
                      {s.member_price && s.member_price < s.price && (
                        <div className="t-meta">會員 {formatPrice(s.member_price)}</div>
                      )}
                    </div>
                  </div>

                  {s.summary && <p className="t-body mb-3">{s.summary}</p>}

                  {Array.isArray(s.features) && s.features.length > 0 && (
                    <ul className="space-y-1.5 mb-3">
                      {s.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 t-body">
                          <span className="text-green-600 flex-shrink-0 mt-0.5">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.suitable && (
                    <p className="t-meta bg-white border border-gray-100 rounded-xl px-3 py-2 mb-3">
                      <strong className="text-gray-700">適合：</strong>{s.suitable}
                    </p>
                  )}

                  <button onClick={() => pick(s.code)}
                    className={active ? 'btn-card' : 'btn-card-ghost'}>
                    {active ? '✓ 已選擇此方案' : '選擇此方案'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 流程 */}
      <section className="mb-8">
        <h2 className="t-section-title mb-4">預約流程</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          {FLOW.map(f => (
            <div key={f.n} className="flex items-start gap-3">
              <span className="w-7 h-7 bg-green-700 text-white rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold mt-0.5">{f.n}</span>
              <div>
                <p className="font-bold text-gray-800 text-base">{f.t}</p>
                <p className="t-meta leading-relaxed">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 預約表單 */}
      <section ref={formRef} className="scroll-mt-24 mb-8">
        <h2 className="t-section-title mb-4">填寫預約資料</h2>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* 方案 */}
          <div>
            <label className="form-label">陪診方案 <span className="text-red-600">*</span></label>
            <select className="form-input" value={selected} onChange={e => setSelected(e.target.value)}>
              {services.map(s => (
                <option key={s.code} value={s.code}>{s.name}（{formatPrice(s.price)}）</option>
              ))}
            </select>
          </div>

          {/* 就診人 */}
          <div className="pt-1">
            <p className="font-bold text-gray-800 mb-3 text-base">👤 就診人資料</p>
            <div className="space-y-3">
              <div>
                <label className="form-label">姓名 <span className="text-red-600">*</span></label>
                <input className="form-input" placeholder="就診人姓名" value={form.patient_name}
                  onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">年齡</label>
                  <input className="form-input" placeholder="例：78" value={form.patient_age}
                    onChange={e => setForm(f => ({ ...f, patient_age: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">性別</label>
                  <select className="form-input" value={form.patient_gender}
                    onChange={e => setForm(f => ({ ...f, patient_gender: e.target.value }))}>
                    <option value="">請選擇</option>
                    <option value="female">女性</option>
                    <option value="male">男性</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">行動能力</label>
                <select className="form-input" value={form.mobility}
                  onChange={e => setForm(f => ({ ...f, mobility: e.target.value }))}>
                  {MOBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 就醫資訊 */}
          <div className="pt-1 border-t border-gray-100">
            <p className="font-bold text-gray-800 mb-3 mt-4 text-base">🏥 就醫資訊</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">就診日期 <span className="text-red-600">*</span></label>
                  <input type="date" className="form-input" value={form.service_date}
                    onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">時段</label>
                  <select className="form-input" value={form.time_slot}
                    onChange={e => setForm(f => ({ ...f, time_slot: e.target.value }))}>
                    {TIME_SLOTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">縣市</label>
                <select className="form-input" value={form.county}
                  onChange={e => setForm(f => ({ ...f, county: e.target.value }))}>
                  <option value="">請選擇縣市</option>
                  {TW_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">醫院名稱</label>
                <input className="form-input" placeholder="例：台大醫院、林口長庚" value={form.hospital}
                  onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">科別 <span className="text-gray-500 font-normal text-sm">（選填）</span></label>
                <input className="form-input" placeholder="例：心臟內科" value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* 加購 */}
          <div className="pt-1 border-t border-gray-100">
            <p className="font-bold text-gray-800 mb-3 mt-4 text-base">➕ 加購服務（選填）</p>
            <div className="space-y-2">
              {ADDON_OPTIONS.map(o => (
                <label key={o.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors min-h-[48px] ${addons.includes(o.value) ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                  <input type="checkbox" className="w-5 h-5 rounded accent-green-700 mt-0.5 flex-shrink-0"
                    checked={addons.includes(o.value)} onChange={() => toggleAddon(o.value)} />
                  <span>
                    <span className="block font-semibold text-gray-800 text-[15px]">{o.label}</span>
                    {o.note && <span className="block t-meta mt-0.5">{o.note}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 聯絡人 */}
          <div className="pt-1 border-t border-gray-100">
            <p className="font-bold text-gray-800 mb-3 mt-4 text-base">📞 聯絡人（我們會與此人確認）</p>
            <div className="space-y-3">
              <div>
                <label className="form-label">姓名 <span className="text-red-600">*</span></label>
                <input className="form-input" placeholder="您的姓名" value={form.contact_name}
                  onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">手機號碼 <span className="text-red-600">*</span></label>
                <input className="form-input" type="tel" inputMode="numeric" placeholder="09xxxxxxxx"
                  value={form.contact_phone}
                  onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">LINE ID</label>
                  <input className="form-input" placeholder="選填" value={form.contact_line}
                    onChange={e => setForm(f => ({ ...f, contact_line: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">與就診人關係</label>
                  <input className="form-input" placeholder="例：子女" value={form.relation}
                    onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">特殊需求備註</label>
                <textarea className="form-input" rows={3}
                  placeholder="例：長輩重聽需大聲說話、需要準備輪椅、慢性病用藥情形…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>

          <button onClick={submit} disabled={submitting} className="btn-primary w-full text-xl py-4">
            {submitting ? '送出中…' : '送出預約（不需先付款）'}
          </button>
          <p className="t-meta text-center">
            送出後由客服與您確認，確認無誤才需匯款
          </p>
        </div>
      </section>

      {/* 服務界線與說明 */}
      <section className="bg-gray-100 rounded-2xl p-5">
        <h2 className="font-bold text-gray-800 mb-3 text-base">重要說明</h2>
        <ul className="space-y-2">
          {[
            '陪診員為生活支援與陪伴人員，非醫療人員，不提供醫療建議、不做醫療判斷。',
            '手術、麻醉等同意書依法須由本人或法定親屬簽署，陪診員無法代簽。',
            '掛號費、醫療費用、交通費、停車費不含在方案內，由就診人自付。',
            '超時將以每 30 分鐘為單位另計，服務前會先告知。',
            '如需取消或改期，請於服務前 24 小時聯絡客服。',
            '陪診員均簽署保密同意，您的就醫資訊不會外流。',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2 t-meta leading-relaxed">
              <span className="text-gray-500 flex-shrink-0">·</span><span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
