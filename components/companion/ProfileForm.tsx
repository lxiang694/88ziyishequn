'use client'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { TW_COUNTIES, EDUCATION_OPTIONS } from '@/lib/careMeta'

interface Props { onSubmitted?: () => void }

const DOC_FIELDS: { key: string; label: string; required: boolean; note?: string }[] = [
  { key: 'doc_id_front', label: '身分證正面', required: true },
  { key: 'doc_id_back', label: '身分證反面', required: true },
  { key: 'doc_bankbook', label: '存摺封面', required: true, note: '需清楚顯示戶名與帳號' },
  { key: 'doc_education', label: '學歷證明', required: false },
  { key: 'doc_certificate', label: '相關證照', required: false, note: '照服員、CPR、護理等' },
]

function DocUpload({ label, required, note, value, onChange }: {
  label: string; required: boolean; note?: string
  value: string | null; onChange: (path: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  // 已有檔案時取簽名網址預覽
  useEffect(() => {
    if (!value) { setPreview(null); return }
    fetch(`/api/companion/upload?path=${encodeURIComponent(value)}&bucket=companion-docs`)
      .then(r => r.json()).then(d => { if (d.success) setPreview(d.url) })
      .catch(() => {})
  }, [value])

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'doc')
    const res = await fetch('/api/companion/upload', { method: 'POST', body: fd })
    const d = await res.json()
    setUploading(false)
    if (d.success) { onChange(d.path); setPreview(d.preview); toast.success(`${label} 已上傳`) }
    else toast.error(d.error || '上傳失敗')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="border-2 border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold text-gray-800 text-[15px]">
            {label} {required && <span className="text-red-600">*</span>}
          </p>
          {note && <p className="t-meta">{note}</p>}
        </div>
        {value && <span className="text-[13px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md flex-shrink-0">已上傳</span>}
      </div>

      {preview && (
        <a href={preview} target="_blank" rel="noopener noreferrer" className="block mb-2">
          {/* 私有檔案的短效簽名網址，不使用 next/image 以免被快取 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full max-h-48 object-contain rounded-lg border border-gray-100 bg-gray-50" />
        </a>
      )}

      <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={handle} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="btn-card-ghost">
        {uploading ? '上傳中…' : value ? '重新上傳' : '選擇檔案上傳'}
      </button>
    </div>
  )
}

export default function ProfileForm({ onSubmitted }: Props) {
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/companion/profile').then(r => r.json()).then(d => {
      if (d.success) setForm({ ...d.data, service_areas: Array.isArray(d.data.service_areas) ? d.data.service_areas : [] })
    })
  }, [])

  if (!form) return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center t-body">載入中…</div>

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const toggleArea = (c: string) =>
    setForm((f: any) => ({
      ...f,
      service_areas: f.service_areas.includes(c) ? f.service_areas.filter((x: string) => x !== c) : [...f.service_areas, c],
    }))

  const save = async (submit: boolean) => {
    setSaving(true)
    const res = await fetch('/api/companion/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, submit }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.success) {
      toast.success(submit ? '已送出審核，我們會盡快與您聯絡' : '已儲存')
      if (submit) onSubmitted?.()
    } else toast.error(d.error || '儲存失敗')
  }

  const Field = ({ k, label, ph, type = 'text', req = false }: any) => (
    <div>
      <label className="form-label">{label} {req && <span className="text-red-600">*</span>}</label>
      <input className="form-input" type={type} placeholder={ph} value={form[k] || ''}
        onChange={e => set(k, e.target.value)} />
    </div>
  )

  return (
    <div className="space-y-5">
      {form.reject_reason && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <p className="font-bold text-red-800 text-base mb-1">審核未通過</p>
          <p className="t-body text-red-900">{form.reject_reason}</p>
          <p className="t-meta mt-2">請依上述說明補正後重新送出審核。</p>
        </div>
      )}

      {/* 基本資料 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800 text-lg">基本資料</h3>
        <Field k="name" label="姓名" req ph="真實姓名" />
        <Field k="id_number" label="身分證字號" req ph="A123456789" />
        <div className="grid grid-cols-2 gap-3">
          <Field k="birthday" label="生日" type="date" />
          <div>
            <label className="form-label">性別</label>
            <select className="form-input" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
              <option value="">請選擇</option>
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
          </div>
        </div>
        <Field k="address" label="聯絡地址" req ph="例：新北市板橋區文化路一段 100 號" />
        <Field k="email" label="Email" type="email" ph="選填" />
      </div>

      {/* 學經歷 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800 text-lg">學歷與經歷</h3>
        <div>
          <label className="form-label">最高學歷</label>
          <select className="form-input" value={form.education || ''} onChange={e => set('education', e.target.value)}>
            <option value="">請選擇</option>
            {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <Field k="school" label="畢業學校 / 科系" ph="例：○○大學 護理系" />
        <div>
          <label className="form-label">相關經歷</label>
          <textarea className="form-input" rows={3} placeholder="例：曾任長照機構照服員 2 年、有陪同長輩就醫經驗"
            value={form.experience || ''} onChange={e => set('experience', e.target.value)} />
        </div>
        <Field k="certifications" label="證照" ph="例：照顧服務員結訓、CPR+AED" />
      </div>

      {/* 服務設定 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800 text-lg">服務設定</h3>
        <div>
          <label className="form-label">聘用型態</label>
          <select className="form-input" value={form.employment_type || 'parttime'}
            onChange={e => set('employment_type', e.target.value)}>
            <option value="parttime">兼職（自行安排時間）</option>
            <option value="fulltime">全職</option>
          </select>
        </div>
        <div>
          <label className="form-label">可服務縣市 <span className="text-red-600">*</span></label>
          <div className="flex flex-wrap gap-2">
            {TW_COUNTIES.map(c => (
              <button key={c} type="button" onClick={() => toggleArea(c)}
                className={`px-3 py-2 min-h-[48px] rounded-xl border-2 text-[15px] font-semibold transition-colors ${form.service_areas.includes(c) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 緊急聯絡人 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800 text-lg">緊急聯絡人</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field k="emergency_contact" label="姓名" ph="緊急聯絡人" />
          <Field k="emergency_relation" label="關係" ph="例：配偶" />
        </div>
        <Field k="emergency_phone" label="聯絡電話" type="tel" ph="09xxxxxxxx" />
      </div>

      {/* 匯款帳戶 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800 text-lg">匯款帳戶（報酬結算用）</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field k="bank_name" label="銀行" ph="例：國泰世華" />
          <Field k="bank_branch" label="分行" ph="例：板橋分行" />
        </div>
        <Field k="bank_account_name" label="戶名" ph="需與身分證姓名相同" />
        <Field k="bank_account" label="帳號" req ph="請填寫完整帳號" />
      </div>

      {/* 證件上傳 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800 text-lg">證件上傳</h3>
        <p className="t-meta">
          🔒 所有證件存放於加密的私有空間，僅限審核人員調閱，不會產生公開連結。
        </p>
        {DOC_FIELDS.map(d => (
          <DocUpload key={d.key} label={d.label} required={d.required} note={d.note}
            value={form[d.key] || null} onChange={p => set(d.key, p)} />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pb-4">
        <button onClick={() => save(false)} disabled={saving} className="btn-card-ghost flex-1">
          {saving ? '儲存中…' : '暫存草稿'}
        </button>
        <button onClick={() => save(true)} disabled={saving} className="btn-primary flex-1">
          {saving ? '處理中…' : '送出審核'}
        </button>
      </div>
    </div>
  )
}
