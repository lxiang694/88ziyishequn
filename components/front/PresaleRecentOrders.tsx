'use client'
import { useEffect, useState } from 'react'
import type { RecentOrderPublic } from '@/lib/presale/maskIdentity'

/**
 * 「最近有人預訂」的輪播區塊。
 *
 * 資料是**真實訂單**，姓名在伺服器端就遮罩過了，電話完全不傳
 * （lib/presale/maskIdentity.ts）。沒有近期訂單時整個區塊不顯示 ——
 * 寧可少一個區塊，也不要放假的購買訊息。
 */
export default function PresaleRecentOrders() {
  const [rows, setRows] = useState<RecentOrderPublic[]>([])
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/presale/recent-orders')
      .then(r => r.json())
      .then(d => { if (alive && d?.success && Array.isArray(d.data)) setRows(d.data) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // 每 3.5 秒換一筆；只有一筆就不輪播，靜靜顯示就好
  useEffect(() => {
    if (rows.length <= 1) return
    const timer = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % rows.length)
        setFading(false)
      }, 250)
    }, 3500)
    return () => clearInterval(timer)
  }, [rows.length])

  if (rows.length === 0) return null

  const current = rows[index]

  return (
    <div
      className="mt-3 flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 overflow-hidden"
      aria-live="off"
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
      </span>

      <p
        className={`text-[14px] text-green-900 leading-snug min-w-0 truncate transition-opacity duration-200 ${
          fading ? 'opacity-0' : 'opacity-100'}`}
      >
        <span className="font-semibold">{current.name}</span>
        <span className="text-green-800 ml-1.5">{current.when}預訂成功</span>
      </p>
    </div>
  )
}
