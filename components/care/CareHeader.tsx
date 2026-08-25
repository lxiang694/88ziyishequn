'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { careBrand, CARE_NAV, CARE_CTA } from '@/lib/careBrand'

/**
 * 陪診品牌專屬頁首。
 * 刻意不重用商城的 SiteHeader：這裡不得出現購物車、商品分類、會員價等商城元素。
 */
export default function CareHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const toggleRef = useRef<HTMLButtonElement>(null)

  // 換頁後自動收合，避免選單蓋住新頁面
  useEffect(() => { setOpen(false) }, [pathname])

  // Esc 關閉並把焦點還給觸發按鈕，鍵盤操作不會迷路
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const isActive = (href: string) => pathname === href

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-3">
        <Link href="/care" className="flex items-center gap-2 min-h-[48px] flex-shrink-0"
          aria-label={`${careBrand.name} 首頁`}>
          <span aria-hidden="true"
            className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-lg">
            陪
          </span>
          <span className="font-bold text-slate-900 text-lg sm:text-xl leading-tight">
            {careBrand.shortName}
          </span>
        </Link>

        {/* 桌面導覽 */}
        <nav className="hidden md:flex items-center gap-1" aria-label="主要導覽">
          {CARE_NAV.map(n => (
            <Link key={n.href} href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={`px-3 py-2 min-h-[48px] flex items-center rounded-lg text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                isActive(n.href) ? 'text-emerald-800 bg-emerald-50' : 'text-slate-700 hover:bg-slate-50'
              }`}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
            className="px-4 min-h-[48px] flex items-center rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-[15px] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            {CARE_CTA.secondary.label}
          </a>
          <Link href={CARE_CTA.primary.href}
            className="px-5 min-h-[48px] flex items-center rounded-xl bg-emerald-700 text-white font-bold text-[15px] hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            {CARE_CTA.primary.label}
          </Link>
        </div>

        {/* 手機選單開關 */}
        <button ref={toggleRef} type="button" onClick={() => setOpen(o => !o)}
          aria-expanded={open} aria-controls="care-mobile-nav"
          className="md:hidden w-12 h-12 flex items-center justify-center rounded-xl border-2 border-slate-200 text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
          <span className="sr-only">{open ? '關閉選單' : '開啟選單'}</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* 手機導覽 */}
      {open && (
        <div id="care-mobile-nav" className="md:hidden border-t border-slate-200 bg-white">
          <nav className="max-w-5xl mx-auto px-4 py-2" aria-label="主要導覽">
            {CARE_NAV.map(n => (
              <Link key={n.href} href={n.href}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={`block px-3 min-h-[48px] flex items-center rounded-lg text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isActive(n.href) ? 'text-emerald-800 bg-emerald-50' : 'text-slate-800'
                }`}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
