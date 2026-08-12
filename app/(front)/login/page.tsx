'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useUserAuth } from '@/components/front/UserAuthContext'
import toast from 'react-hot-toast'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/account'
  const { user, loading: authLoading, refresh } = useUserAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Already logged in → redirect
  useEffect(() => {
    if (!authLoading && user) router.replace(next)
  }, [user, authLoading, router, next])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('請填寫 Email 和密碼')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      const msg = error.message.includes('Invalid login') || error.message.includes('credentials')
        ? 'Email 或密碼錯誤'
        : error.message.includes('Email not confirmed')
        ? '請先到信箱點擊驗證連結'
        : error.message
      toast.error(msg)
      setSubmitting(false)
      return
    }
    await refresh()
    toast.success('登入成功')
    router.replace(next)
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
          <h1 className="text-2xl font-bold text-gray-900">會員登入</h1>
          <p className="text-gray-500 text-sm mt-1">登入後查看訂單與享受快速結帳</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
            <label className="form-label">Email</label>
            <input type="email" required autoComplete="email" className="form-input"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>

          <div>
            <label className="form-label">密碼</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                className="form-input pr-12"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="輸入密碼" />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600 text-[13px] font-bold">
                {showPwd ? '隱藏' : '顯示'}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-green-700 hover:text-green-800 font-bold">
              忘記密碼？
            </Link>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full text-lg py-3.5 disabled:opacity-50">
            {submitting ? '登入中...' : '登入'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          還沒有帳號？
          <Link href="/signup" className="ml-1 text-green-700 font-bold hover:text-green-800">立即註冊</Link>
        </p>

        {/* Guest order query — for users who don't want to register */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-amber-900 mb-1">📦 不想註冊？沒關係</p>
          <p className="text-[13px] text-amber-700 leading-relaxed mb-3">
            您可以直接用<strong>下單時填的手機號碼</strong>查詢訂單狀態，不必註冊會員。
          </p>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-amber-800 font-bold text-sm hover:text-amber-900"
          >
            👉 用手機號碼查訂單
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>

        <p className="text-center text-[13px] text-gray-600 mt-8 leading-relaxed">
          有問題嗎？右下角 LINE 真人客服即時回覆
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-600">載入中...</div>}>
      <LoginForm />
    </Suspense>
  )
}
