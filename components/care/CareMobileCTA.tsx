'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CARE_CTA } from '@/lib/careBrand'

/**
 * 手機底部固定行動列，只有兩個按鈕。
 *
 * 兩個遮擋問題必須避免：
 * 1. 鍵盤打開時蓋住輸入框 —— 表單聚焦時自動隱藏
 * 2. 蓋住頁尾法律連結或表單送出鈕 —— CareSiteShell 於 <main> 後面加等高墊片
 */
export default function CareMobileCTA() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
    const onFocus = (e: FocusEvent) => { if (isField(e.target)) setHidden(true) }
    const onBlur = () => setHidden(false)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
    }
  }, [])

  if (hidden) return null

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-slate-200 px-3 pt-2"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-2">
        <a href={CARE_CTA.secondary.href} target="_blank" rel="noopener noreferrer"
          className="flex-1 min-h-[48px] flex items-center justify-center rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
          {CARE_CTA.secondary.label}
        </a>
        <Link href={CARE_CTA.primary.href}
          className="flex-[1.4] min-h-[48px] flex items-center justify-center rounded-xl bg-emerald-700 text-white font-bold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
          {CARE_CTA.primary.label}
        </Link>
      </div>
    </div>
  )
}
