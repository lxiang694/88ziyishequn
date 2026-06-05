'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Floating "back / home" nav at the top-left, sits just below the fixed header.
 * - Two small pill buttons: 上一頁 (browser back) and 首頁 (link to /)
 * - Hidden on the homepage itself
 * - Familiar pattern for Taiwan mobile users (Shopee, LINE Today, Yahoo)
 */
export default function BackHomeNav() {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show on homepage
  if (pathname === '/') return null

  // Don't show on admin pages (admin has its own sidebar)
  if (pathname.startsWith('/admin')) return null

  const handleBack = () => {
    // If browser has history, go back; otherwise go home
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <div
      className="fixed left-2 sm:left-3 z-30 flex gap-1.5"
      style={{ top: 'calc(64px + 8px)' }}
    >
      <button
        onClick={handleBack}
        className="flex items-center gap-1 bg-white/95 backdrop-blur border-2 border-gray-200 hover:border-green-500 hover:text-green-700 text-gray-700 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-bold shadow-md transition-colors"
        aria-label="返回上一頁"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        上一頁
      </button>

      <Link
        href="/"
        className="flex items-center gap-1 bg-white/95 backdrop-blur border-2 border-gray-200 hover:border-green-500 hover:text-green-700 text-gray-700 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-bold shadow-md transition-colors"
        aria-label="回首頁"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        首頁
      </Link>
    </div>
  )
}
