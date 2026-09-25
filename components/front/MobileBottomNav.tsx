'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from './CartContext'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { totalItems } = useCart()
  const [inputFocused, setInputFocused] = useState(false)

  // 鍵盤彈出時（輸入框聚焦）隱藏底部導覽列，避免浮起蓋住輸入欄位
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) setInputFocused(true)
    }
    const onFocusOut = () => setInputFocused(false)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // 後台不顯示
  if (pathname.startsWith('/admin')) return null

  const isHome = pathname === '/'
  const isShop = pathname.startsWith('/shop')
  const isCart = pathname === '/cart'
  const isAccount = pathname.startsWith('/account')

  const itemCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${active ? 'text-green-700' : 'text-gray-600'}`

  return (
    <>
      {/* 底部固定導覽列（手機／平板） */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] ${inputFocused ? 'hidden' : ''}`}
        style={{ height: 60, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-full max-w-5xl mx-auto">
          <Link href="/" className={itemCls(isHome)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
            <span className="text-[13px] font-semibold">首頁</span>
          </Link>
          {/* 直接進賣場。/shop 一進去左邊就是完整分類欄，
              再疊一層彈出選單只是多一次點擊 */}
          <Link href="/shop" className={itemCls(isShop)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
            <span className="text-[13px] font-semibold">商品分類</span>
          </Link>
          <Link href="/cart" className={itemCls(isCart)}>
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[12px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{totalItems > 9 ? '9+' : totalItems}</span>
              )}
            </div>
            <span className="text-[13px] font-semibold">購物車</span>
          </Link>
          <Link href="/account" className={itemCls(isAccount)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-[13px] font-semibold">會員</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
