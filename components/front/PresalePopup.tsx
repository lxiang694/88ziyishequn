'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { PRESALE } from '@/lib/presale/camelliaOil'
import { shouldShowPopup } from '@/lib/presale/popupState'
import { formatPrice } from '@/lib/utils'

const CFG = PRESALE.popup

/**
 * 野生茶籽油預售彈窗。
 *
 * 顯示 5 秒後自動關閉，也可以手動關。三個刻意的設計：
 *
 *   1. 使用者一碰到彈窗（移入、聚焦、點擊）就取消自動關閉 ——
 *      正在讀的時候被關掉比沒看到還糟。
 *   2. 不搶焦點。這是促銷訊息不是必要對話框，
 *      鍵盤使用者打到一半被跳走會很煩。Esc 仍然可以關。
 *   3. 關掉之後 12 小時內不再出現，而且結帳流程中完全不彈。
 */
export default function PresalePopup({ coverImage }: { coverImage?: string | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelAutoClose = useCallback(() => {
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current)
      autoCloseRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    cancelAutoClose()
    setLeaving(true)
    // 等淡出動畫跑完再卸載
    setTimeout(() => { setOpen(false); setLeaving(false) }, 200)
  }, [cancelAutoClose])

  useEffect(() => {
    let lastShownAt: number | null = null
    try {
      const raw = localStorage.getItem(CFG.storageKey)
      lastShownAt = raw ? Number(raw) || null : null
    } catch {
      // 無痕視窗或封鎖 cookie 時讀不到；當成沒看過即可
    }

    const ok = shouldShowPopup({
      enabled: CFG.enabled,
      now: new Date(),
      hideAfter: CFG.hideAfter,
      lastShownAt,
      cooldownHours: CFG.cooldownHours,
      pathname: pathname || '/',
      excludedPaths: CFG.excludedPaths,
    })
    if (!ok) return

    const showTimer = setTimeout(() => {
      setOpen(true)
      try { localStorage.setItem(CFG.storageKey, String(Date.now())) } catch {}
      autoCloseRef.current = setTimeout(close, CFG.autoCloseMs)
    }, CFG.delayMs)

    return () => {
      clearTimeout(showTimer)
      cancelAutoClose()
    }
    // 只在首次掛載時判斷一次；換頁不重複彈
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc 關閉
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 transition-opacity duration-200 ${
        leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* 背景遮罩：點一下也可以關 */}
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="presale-popup-title"
        onMouseEnter={cancelAutoClose}
        onFocusCapture={cancelAutoClose}
        onClick={cancelAutoClose}
        onTouchStart={cancelAutoClose}
        className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-transform duration-200 ${
          leaving ? 'translate-y-2 sm:scale-95' : 'translate-y-0 sm:scale-100'}`}
      >
        <button
          onClick={close}
          aria-label="關閉"
          className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-gray-600 hover:text-gray-900 text-2xl leading-none flex items-center justify-center shadow-sm"
        >
          ×
        </button>

        {coverImage && (
          <div className="aspect-[4/3] bg-gray-100 relative">
            <Image src={coverImage} alt="" fill className="object-cover"
              sizes="(max-width: 640px) 100vw, 384px" />
          </div>
        )}

        <div className="p-5">
          <span className="inline-block bg-amber-100 text-amber-800 text-[13px] font-bold px-2.5 py-1 rounded-full mb-2">
            🌿 預售中 · 今年只有這一批
          </span>

          <h2 id="presale-popup-title" className="text-2xl font-bold text-gray-900 leading-snug mb-1">
            {PRESALE.title}
          </h2>
          <p className="text-gray-600 text-[15px] leading-relaxed mb-3">
            山上現在還在採，果實自然裂開才摘。預計 {PRESALE.shipMonth} 出油後直接寄給您。
          </p>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-green-700">
              {formatPrice(PRESALE.displayPrice)}
            </span>
            <span className="text-gray-500 text-[15px]">/ {PRESALE.displaySpec}</span>
          </div>

          <Link
            href="/camellia-oil"
            onClick={close}
            className="block text-center w-full min-h-[52px] leading-[52px] rounded-2xl bg-green-700 hover:bg-green-800 text-white font-bold text-lg transition-colors"
          >
            看看這批油
          </Link>
          <button
            onClick={close}
            className="w-full min-h-[44px] text-gray-500 text-[15px] mt-1"
          >
            下次再說
          </button>
        </div>
      </div>
    </div>
  )
}
