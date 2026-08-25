'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

export default function CompanionRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', password: '', password2: '' })
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('請填寫姓名')
    if (!/^09\d{8}$/.test(form.phone.trim())) return toast.error('請填寫正確手機號碼（09xxxxxxxx）')
    if (form.password.length < 6) return toast.error('密碼至少 6 碼')
    if (form.password !== form.password2) return toast.error('兩次密碼不一致')
    if (!consent) return toast.error('請先閱讀並同意個人資料蒐集聲明')

    setSubmitting(true)
    try {
      const res = await fetch('/api/companion/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim(), password: form.password, consent }),
      })
      const d = await res.json()
      if (d.success) {
        toast.success('註冊成功，請接著完成資料填寫')
        router.push('/companion?tab=profile')
      } else toast.error(d.error || '註冊失敗')
    } catch {
      toast.error('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🩺</div>
          <h1 className="text-2xl font-bold text-gray-900">申請成為陪診員</h1>
          <p className="t-meta mt-1">健康優選 88自醫社群・全職兼職皆可，自行安排時間</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="form-label">姓名 <span className="text-red-600">*</span></label>
            <input className="form-input" placeholder="請填寫真實姓名" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">手機號碼（即帳號）<span className="text-red-600">*</span></label>
            <input className="form-input" type="tel" inputMode="numeric" placeholder="09xxxxxxxx"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">設定密碼 <span className="text-red-600">*</span></label>
            <input className="form-input" type="password" placeholder="至少 6 碼"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">再次輸入密碼 <span className="text-red-600">*</span></label>
            <input className="form-input" type="password" placeholder="請再輸入一次"
              value={form.password2} onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} />
          </div>

          {/* 個資同意 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="font-bold text-gray-800 text-[15px] mb-2">個人資料蒐集聲明</p>
            <ul className="space-y-1 t-meta leading-relaxed">
              <li>· <strong>蒐集目的</strong>：陪診員資格審核、派工聯繫、報酬結算與稅務申報。</li>
              <li>· <strong>蒐集項目</strong>：姓名、手機、身分證字號與證件影本、地址、學歷、金融帳戶。</li>
              <li>· <strong>保存期間</strong>：合作關係存續期間及法令規定之保存期限。</li>
              <li>· <strong>保護方式</strong>：證件與帳戶資料存放於加密的私有空間，僅限授權人員調閱，不對外公開。</li>
              <li>· 您可隨時要求查詢、更正或刪除個人資料。</li>
            </ul>
            <label className="flex items-start gap-3 mt-3 cursor-pointer min-h-[48px]">
              <input type="checkbox" className="w-5 h-5 rounded accent-green-700 mt-0.5 flex-shrink-0"
                checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span className="text-[15px] font-semibold text-gray-800">我已閱讀並同意上述個人資料蒐集與使用</span>
            </label>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full text-lg py-3.5">
            {submitting ? '註冊中…' : '註冊並填寫資料'}
          </button>

          <p className="t-meta text-center">
            註冊後需完成資料與證件上傳，經審核通過才會開始派工。
          </p>
          <p className="t-meta text-center">
            已有帳號？<Link href="/companion/login" className="text-green-700 font-bold underline">前往登入</Link>
          </p>
        </form>
      </div>
      <Toaster position="top-center" toastOptions={{ duration: 3500, style: { fontSize: '16px', fontWeight: '600' } }} />
    </div>
  )
}
