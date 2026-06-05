'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUserAuth } from '@/components/front/UserAuthContext'
import { validateTWPhone } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const router = useRouter()
  const { user, loading: authLoading, refresh } = useUserAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!authLoading && user) router.replace('/account')
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('請填寫姓名'); return }
    if (!validateTWPhone(phone)) { toast.error('手機號碼格式錯誤（09xxxxxxxx）'); return }
    if (!email.trim() || !email.includes('@')) { toast.error('請填寫有效 Email'); return }
    if (password.length < 6) { toast.error('密碼至少 6 個字元'); return }
    if (!agreed) { toast.error('請勾選同意條款'); return }

    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim(), phone: phone.trim() },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
      },
    })

    if (error) {
      const msg = error.message.includes('already registered') ? '此 Email 已被註冊'
        : error.message.includes('valid email') ? 'Email 格式錯誤'
        : error.message
      toast.error(msg)
      setSubmitting(false)
      return
    }

    // Two scenarios: confirm email enabled (user must verify), or auto-confirmed
    if (data.session) {
      // Auto-signed in (email confirmation off)
      await refresh()
      toast.success('註冊成功，歡迎加入！')
      router.replace('/account')
    } else {
      // Email confirmation required
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">驗證郵件已發送</h1>
          <p className="text-gray-600 leading-relaxed mb-6">
            我們已寄出驗證郵件到<br /><strong className="text-green-700">{email}</strong><br />
            請到信箱點擊連結完成驗證後再登入
          </p>
          <p className="text-sm text-gray-400 mb-6">沒收到？請檢查垃圾郵件夾</p>
          <Link href="/login" className="btn-primary w-full block">前往登入</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="w-14 h-14 bg-green-700 rounded-2xl mx-auto flex items-center justify-center shadow-md mb-3">
              <span className="text-white font-bold text-3xl leading-none">健</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">註冊新會員</h1>
          <p className="text-gray-500 text-sm mt-1">3 分鐘完成註冊，享受快速結帳</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="form-label">姓名 <span className="text-red-500">*</span></label>
            <input type="text" required className="form-input"
              value={name} onChange={e => setName(e.target.value)} placeholder="請輸入您的姓名" />
          </div>

          <div>
            <label className="form-label">手機號碼 <span className="text-red-500">*</span></label>
            <input type="tel" inputMode="numeric" required className="form-input"
              value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
            <p className="text-xs text-gray-400 mt-1">用於訂單聯繫，未來下單會自動帶入</p>
          </div>

          <div>
            <label className="form-label">Email <span className="text-red-500">*</span></label>
            <input type="email" required autoComplete="email" className="form-input"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            <p className="text-xs text-gray-400 mt-1">登入帳號 + 接收訂單通知</p>
          </div>

          <div>
            <label className="form-label">密碼 <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} required minLength={6} autoComplete="new-password"
                className="form-input pr-12"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 個字元" />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold">
                {showPwd ? '隱藏' : '顯示'}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-green-600" />
            <span className="text-sm text-gray-600 leading-relaxed">
              我已閱讀並同意服務條款，授權使用我的個資處理訂單與客服
            </span>
          </label>

          <button type="submit" disabled={submitting} className="btn-primary w-full text-lg py-3.5 disabled:opacity-50">
            {submitting ? '註冊中...' : '註冊並登入'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          已經是會員？
          <Link href="/login" className="ml-1 text-green-700 font-bold hover:text-green-800">立即登入</Link>
        </p>
      </div>
    </div>
  )
}
