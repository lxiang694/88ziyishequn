'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { toast.error('請填寫 Email'); return }
    setSubmitting(true)
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) {
      toast.error(error.message)
      setSubmitting(false)
      return
    }
    setDone(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {done ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="text-5xl mb-4">📬</div>
            <h1 className="text-xl font-bold text-gray-900 mb-3">重設連結已發送</h1>
            <p className="text-gray-600 leading-relaxed mb-6">
              若帳號存在，您將收到一封含重設連結的信件。<br />
              請到信箱點擊連結重新設定密碼
            </p>
            <p className="text-sm text-gray-400 mb-6">沒收到？請檢查垃圾郵件夾</p>
            <Link href="/login" className="btn-primary w-full block">返回登入</Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">忘記密碼</h1>
              <p className="text-gray-500 text-sm">輸入註冊時的 Email，我們會寄出重設連結</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div>
                <label className="form-label">Email</label>
                <input type="email" required autoComplete="email" className="form-input"
                  value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full text-lg py-3.5 disabled:opacity-50">
                {submitting ? '寄送中...' : '寄出重設連結'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              <Link href="/login" className="text-green-700 font-bold hover:text-green-800">← 返回登入</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
