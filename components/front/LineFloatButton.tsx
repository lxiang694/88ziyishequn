'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function LineFloatButton() {
  const pathname = usePathname()
  const [inputFocused, setInputFocused] = useState(false)

  // 鍵盤彈出時（輸入框聚焦）隱藏，避免浮鈕蓋住輸入欄位
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

  // 購物車 / 結帳頁底部有固定結帳條 → 手機時把浮鈕升到結帳條上方，避免遮住主要按鈕
  const hasBottomBar = pathname === '/cart' || pathname === '/checkout'
  const mobileBottom = hasBottomBar
    ? 'bottom-[calc(210px+env(safe-area-inset-bottom))]'
    : 'bottom-[calc(72px+env(safe-area-inset-bottom))]'

  return (
    <a
      href="https://line.me/ti/p/yJdrshwviU"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINE 聯絡客服"
      className={`fixed right-4 z-[45] ${mobileBottom} md:bottom-6 flex items-center justify-center gap-2 bg-[#00B900] hover:bg-[#00a000] text-white rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 ${inputFocused ? 'hidden' : ''}`}
    >
      <svg width="24" height="24" viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <path d="M24 4C13 4 4 11.8 4 21.4c0 8.3 7.4 15.3 17.4 16.7.7.1 1.6.5 1.8 1 .2.5.1 1.3 0 1.8l-.3 1.8c-.1.5-.4 2 1.8 1.1 2.2-.9 11.8-7 16.1-12C43.8 29 44 25.3 44 21.4 44 11.8 35 4 24 4z"/>
      </svg>
      <span className="font-bold text-sm hidden md:inline">客服</span>
    </a>
  )
}
