'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUserAuth } from './UserAuthContext'
import toast from 'react-hot-toast'

export default function UserMenu() {
  const { user, loading, signOut } = useUserAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Guest state — show a dropdown with login + register + guest order query
  if (loading || !user) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-gray-700 bg-gray-50 hover:bg-green-50 border-2 border-gray-200 hover:border-green-400 px-3 sm:px-4 py-2.5 rounded-2xl transition-colors font-bold text-sm"
          style={{ minHeight: '44px' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="hidden sm:inline">會員</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
            <div className="p-4 border-b border-gray-100 bg-green-50/50">
              <p className="font-bold text-gray-800 text-sm">您好！</p>
              <p className="text-xs text-gray-500 mt-0.5">登入後享受更多服務</p>
            </div>
            <div className="py-2">
              <Link href="/login" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors">
                <span className="text-lg">🔑</span>
                <span className="text-sm font-semibold">會員登入</span>
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors">
                <span className="text-lg">✨</span>
                <span className="text-sm font-semibold">註冊新帳號</span>
              </Link>
              <div className="border-t border-gray-100 my-1" />
              <Link href="/orders" onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors">
                <span className="text-lg flex-shrink-0">📦</span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">用手機查訂單</p>
                  <p className="text-xs text-gray-400 mt-0.5">不需註冊也能查</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Defensive: fall back through every possible name source
  const metaName = (user.user_metadata && typeof user.user_metadata === 'object'
    ? (user.user_metadata as any).name : null) as string | null
  const emailPart = typeof user.email === 'string' ? user.email.split('@')[0] : null
  const displayName = metaName || emailPart || '會員'
  const initial = (displayName.charAt(0) || '會').toUpperCase()

  const handleSignOut = async () => {
    await signOut()
    toast.success('已登出')
    setOpen(false)
    router.push('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-2 border-green-200 px-2.5 sm:px-3 py-1.5 rounded-2xl transition-colors"
        style={{ minHeight: '44px' }}
      >
        <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
          {initial}
        </span>
        <span className="hidden sm:inline text-green-800 font-bold text-sm max-w-[80px] truncate">{displayName}</span>
        <svg className={`w-4 h-4 text-green-700 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="p-4 border-b border-gray-100 bg-green-50/50">
            <p className="font-bold text-gray-800 text-sm">{displayName}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user.email}</p>
          </div>
          <div className="py-2">
            {[
              { href: '/account', label: '會員中心', icon: '🏠' },
              { href: '/account/orders', label: '我的訂單', icon: '📦' },
              { href: '/account/profile', label: '個人資料', icon: '✍️' },
            ].map(item => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors">
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            ))}
          </div>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 border-t border-gray-100 hover:bg-red-50 text-red-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm font-bold">登出</span>
          </button>
        </div>
      )}
    </div>
  )
}
