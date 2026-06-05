'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // After clicking email link, Supabase puts the recovery session in the URL
    // The auth state change listener will pick it up
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })
    // Check if already in a recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('密碼至少 6 個字元'); return }
    if (password !== confirmPwd) { toast.error('兩次密碼不一致'); return }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
      setSubmitting(false)
      return
    }
    toast.success('密碼已更新，請重新登入')
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">重設密碼</h1>
          <p className="text-gray-500 text-sm">請輸入您的新密碼</p>
        </div>

        {!ready ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500">驗證中...</p>
            <p className="text-xs text-gray-400 mt-2">如未自動跳轉，請從信件再次點擊重設連結</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="form-label">新密碼</label>
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

            <div>
              <label className="form-label">再次確認新密碼</label>
              <input type={showPwd ? 'text' : 'password'} required minLength={6} autoComplete="new-password"
                className="form-input"
                value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="再輸入一次" />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full text-lg py-3.5 disabled:opacity-50">
              {submitting ? '更新中...' : '更新密碼'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-green-700 font-bold hover:text-green-800">← 返回登入</Link>
        </p>
      </div>
    </div>
  )
}
