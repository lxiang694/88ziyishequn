'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { utmFromSearch } from '@/lib/trafficSource'

/**
 * 前台流量埋點：每次路由變化時上報一筆瀏覽紀錄到 /api/track。
 * 不渲染任何內容，失敗不影響頁面。
 */
export default function TrafficTracker() {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    // 後台與重複路徑不上報
    if (pathname.startsWith('/admin')) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname

    // utm 標記（分享連結加的 ?utm_source=line…）一起送，後台才分得出 LINE 等來源
    const payload = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ...utmFromSearch(window.location.search),
    })

    // keepalive 確保切換頁面時仍會送出
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
