'use client'
import Link from 'next/link'
import { useCart } from './CartContext'
import UserMenu from './UserMenu'

export default function SiteHeader() {
  const { totalItems } = useCart()
  return (
    <header className="bg-white fixed top-0 left-0 right-0 z-40 border-b border-green-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-3">

        {/* Logo */}
        <Link href="/" className="flex items-center no-underline flex-shrink-0" aria-label="健康優選">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="w-11 h-11 sm:w-12 sm:h-12">
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
        </Link>

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
