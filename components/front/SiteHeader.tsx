'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from './CartContext'
import UserMenu from './UserMenu'

/**
 * 前台表頭。
 *
 * 「上一頁」放在表頭最左邊（首頁以外的每一頁），跟手機 App 的返回鍵同一個位置：
 * 表頭一直固定在最上面，捲到哪都按得到，也不會像以前的浮動按鈕那樣蓋住商品圖片。
 * 回首頁就點旁邊的「健康優選」Logo（手機的底部導覽列也有「首頁」）。
 */
export default function SiteHeader() {
  const { totalItems } = useCart()
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/'

  // 有上一頁就回上一頁；從 LINE 連結直接打開的（沒有上一頁）就回首頁
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/')
  }

  return (
    <header className="bg-white fixed top-0 left-0 right-0 z-40 border-b border-green-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-3">

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {!isHome && (
          <button type="button" onClick={goBack} aria-label="回上一頁"
            className="-ml-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Logo：點了回首頁 */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 no-underline flex-shrink-0" aria-label="健康優選首頁">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 sm:w-11 sm:h-11">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0" stopColor="#15803d"/>
                <stop offset="1" stopColor="#16a34a"/>
              </linearGradient>
            </defs>
            <rect width="48" height="48" rx="14" fill="url(#logoGrad)"/>
            {/* Stylized leaf — natural health theme */}
            <path
              d="M35 12 C 33 24, 25 32, 14 33 C 14 22, 22 14, 35 12 Z"
              fill="#ffffff"
              opacity="0.97"
            />
            {/* Leaf vein */}
            <path
              d="M34 13 L 19 28"
              stroke="#15803d"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.45"
            />
            {/* Small accent dot for premium feel */}
            <circle cx="36" cy="34" r="2.5" fill="#fbbf24"/>
          </svg>
          <span className="leading-tight">
            <span className="block text-base sm:text-xl font-bold tracking-wide text-[#214e39]">健康優選</span>
            <span className="hidden sm:block mt-1 text-[11px] tracking-widest text-[#62745e]">88 社群精選</span>
          </span>
        </Link>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <UserMenu />

          <Link href="/cart"
            className="flex items-center gap-2 text-white bg-green-700 hover:bg-green-800 px-3 sm:px-5 py-2.5 rounded-2xl transition-colors font-bold text-sm sm:text-base shadow-sm"
            style={{ minHeight: '44px' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>購物車</span>
            {totalItems > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[13px] rounded-full min-w-[22px] h-[22px] flex items-center justify-center font-bold px-1 shadow">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}
