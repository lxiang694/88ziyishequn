'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Toaster } from 'react-hot-toast'

export default function CompanionLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/companion/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password }),
      })
      const d = await res.json()
      if (d.success) {
        toast.success(`歡迎回來，${d.data.name}`)
        router.push('/companion')
      } else {
        toast.error(d.error || '登入失敗')
      }
    } catch {
      toast.error('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🩺</div>
          <h1 className="text-2xl font-bold text-gray-900">陪診員系統</h1>
          <p className="t-meta mt-1">健康優選 88自醫社群</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="form-label">手機號碼</label>
            <input className="form-input" type="tel" inputMode="numeric" placeholder="09xxxxxxxx"
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="form-label">密碼</label>
            <input className="form-input" type="password" placeholder="請輸入密碼"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full text-lg py-3.5">
            {submitting ? '登入中…' : '登入'}
          </button>
          <p className="t-meta text-center">
            尚未有帳號？請聯絡客服申請成為陪診員
          </p>
        </form>
      </div>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: '16px', fontWeight: '600' } }} />
    </div>
  )
}
