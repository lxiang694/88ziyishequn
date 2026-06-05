'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AdminLoginPage() {
  const router = useRouter()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !password) { toast.error('請填寫帳號與密碼'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) })
      const data = await res.json()
      if (data.success) { toast.success('歡迎回來，' + data.data.name + '！'); router.push('/admin/dashboard') }
      else toast.error(data.error || '登入失敗')
    } catch { toast.error('網路錯誤，請稍後再試') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">健</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">健康優選後台</h1>
          <p className="text-gray-500 mt-1">請登入以繼續</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="form-label">帳號</label>
            <input className="form-input" type="text" placeholder="請輸入帳號" value={account} onChange={e => setAccount(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="form-label">密碼</label>
            <input className="form-input" type="password" placeholder="請輸入密碼" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-xl mt-2">{loading ? '登入中...' : '登入'}</button>
        </form>
      </div>
    </div>
  )
}
