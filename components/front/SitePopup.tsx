'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  pickPopup, storageKeyFor, isInCooldown, type PopupRow,
} from '@/lib/popups/domain'

/**
 * 前台彈窗。設定全部來自後台（site_popups），程式碼裡沒有寫死的內容。
 *
 * 三個刻意的設計：
 *
 *   1. 使用者一碰到彈窗（移入、聚焦、點擊、觸控）就取消自動關閉 ——
 *      正在讀的時候被關掉比沒看到還糟。
 *   2. 不搶焦點。這是促銷訊息不是必要對話框，
 *      鍵盤使用者打字打到一半被跳走會很煩。Esc 仍然可以關。
 *   3. 每個彈窗各自記冷卻，換一個新彈窗不會被上一個的冷卻擋住。
 */
export default function SitePopup() {
  const pathname = usePathname()
  const [popup, setPopup] = useState<PopupRow | null>(null)
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [cover, setCover] = useState<string | null>(null)
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
    setTimeout(() => { setOpen(false); setLeaving(false) }, 200)
  }, [cancelAutoClose])

  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []

    // 測試用：?popup=1 強制顯示，略過冷卻與期間限制。
    // 沒有這個開關的話，看過一次之後就無法再驗證，很難確認有沒有壞。
    let force = false
    try {
      force = new URLSearchParams(window.location.search).get('popup') === '1'
    } catch {}

    ;(async () => {
      let rows: PopupRow[] = []
      try {
        const res = await fetch('/api/site-popups')
        const d = await res.json()
        if (d?.success && Array.isArray(d.data)) rows = d.data
      } catch {
        return // 抓不到就整個不顯示，不影響網站其他部分
      }
      if (!alive) return

      const chosen = pickPopup(rows, pathname || '/', new Date())
      if (!chosen) return

      if (!force) {
        let lastShownAt: number | null = null
        try {
          const raw = localStorage.getItem(storageKeyFor(chosen.id))
          lastShownAt = raw ? Number(raw) || null : null
        } catch {
          // 無痕視窗或封鎖 cookie 時讀不到；當成沒看過
        }
        if (isInCooldown(lastShownAt, chosen.cooldown_hours)) return
      }

      setPopup(chosen)

      timers.push(setTimeout(() => {
        if (!alive) return
        setOpen(true)
        if (!force) {
          try { localStorage.setItem(storageKeyFor(chosen.id), String(Date.now())) } catch {}
        }
        // auto_close_ms = 0 代表不自動關閉
        if (chosen.auto_close_ms > 0) {
          autoCloseRef.current = setTimeout(close, chosen.auto_close_ms)
        }
      }, force ? 100 : chosen.delay_ms))

      // 沒有指定圖片時，用關聯商品的封面
      if (!chosen.image_url && chosen.product_slug) {
        try {
          const r = await fetch(`/api/products/${chosen.product_slug}`)
          const d = await r.json()
          if (alive && d?.success && d.data?.cover_image_url) setCover(d.data.cover_image_url)
        } catch {}
      }
    })()

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      cancelAutoClose()
    }
    // 只在首次掛載時判斷一次；換頁不重複彈
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !popup) return null

  const image = popup.image_url || cover

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 transition-opacity duration-200 ${
        leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-popup-title"
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

        {image && (
          <div className="aspect-[4/3] bg-gray-100 relative">
            <Image src={image} alt="" fill className="object-cover"
              sizes="(max-width: 640px) 100vw, 384px" />
          </div>
        )}

        <div className="p-5">
          {popup.badge_text && (
            <span className="inline-block bg-amber-100 text-amber-800 text-[13px] font-bold px-2.5 py-1 rounded-full mb-2">
              {popup.badge_text}
            </span>
          )}

          <h2 id="site-popup-title" className="text-2xl font-bold text-gray-900 leading-snug mb-1">
            {popup.title}
          </h2>

          {popup.body && (
            <p className="text-gray-600 text-[15px] leading-relaxed mb-3">{popup.body}</p>
          )}

          {popup.price_text && (
            <p className="text-2xl font-bold text-green-700 mb-4">{popup.price_text}</p>
          )}

          <Link
            href={popup.link_path}
            onClick={close}
            className="block text-center w-full min-h-[52px] leading-[52px] rounded-2xl bg-green-700 hover:bg-green-800 text-white font-bold text-lg transition-colors"
          >
            {popup.cta_text}
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
