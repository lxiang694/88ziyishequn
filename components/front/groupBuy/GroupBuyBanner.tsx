'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { campaignPhase, formatTwDateTime } from '@/lib/groupBuy/domain'
import type { CampaignTeaser } from '@/lib/groupBuy/repo'

/** 剩多久截單：剩 3 天／剩 5 小時／即將截單 */
function remaining(ms: number) {
  const h = Math.floor(ms / 3600_000)
  if (h >= 24) return `剩 ${Math.floor(h / 24)} 天`
  if (h >= 1) return `剩 ${h} 小時`
  return '即將截單'
}

/**
 * 首頁搜尋框上方的「每月團購」入口。
 *
 * 用網站主色的深綠底、白字置中，在米色底的首頁上一眼就看得到，但仍是同一套
 * 顏色，不會像外掛廣告。狀態（開團中剩幾天／幾號開團）在客人手機上即時算，
 * 首頁快取 60 秒也不會顯示過期的倒數。後台把團購關閉（沒有任何開啟中的檔期）
 * 時整條不顯示。
 */
export default function GroupBuyBanner({ campaign, preview = false }: { campaign: CampaignTeaser | null; preview?: boolean }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!campaign) return null
  const phase = now ? campaignPhase(campaign, now) : null
  const status = phase === 'open' ? `🔥 開團中・${remaining(new Date(campaign.ends_at).getTime() - now!.getTime())}`
    : phase === 'upcoming' ? `⏰ ${formatTwDateTime(campaign.starts_at)} 開團`
    : phase === 'closed' ? '本期已截單・下期開團 LINE 通知'
    : '限時開團・截單後統一出貨'
  const cta = phase === 'open' ? '立即跟團' : '看團購內容'
  const bg = campaign.banner_image_url && /^https?:\/\//.test(campaign.banner_image_url) ? campaign.banner_image_url : null

  return (
    <Link href="/group-buy" tabIndex={preview ? -1 : undefined} onClick={preview ? e => e.preventDefault() : undefined}
      className={`group relative mt-4 block overflow-hidden rounded-3xl bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 px-5 py-5 text-center text-white shadow-md transition-transform active:scale-[0.99] ${preview ? 'pointer-events-none' : ''}`}>
      {bg ? <>
        {/* 後台上傳的背景圖：鋪滿，上面疊一層深色漸層，白字不管圖片多亮都看得清楚 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/60" />
      </> : <>
        {/* 兩側淡淡的冰塊點綴：冷凍團購的意象，不搶字 */}
        <span aria-hidden className="pointer-events-none absolute -left-3 top-3 select-none text-5xl opacity-20">🧊</span>
        <span aria-hidden className="pointer-events-none absolute -right-2 bottom-2 select-none text-6xl opacity-20">🧊</span>
      </>}
      <span className="relative block">

      <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold ${phase === 'open' ? 'bg-amber-300 text-amber-950' : 'bg-white/15 text-white'}`}>
        {status}
      </span>
      <p className="mt-2 text-[28px] font-extrabold leading-tight tracking-[0.2em] [text-shadow:0_2px_8px_rgba(0,0,0,0.25)]">每月團購</p>
      <p className="mt-1 line-clamp-1 text-[15px] text-green-50/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
        {campaign.title}
      </p>
      <span className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-full bg-white px-5 text-[15px] font-bold text-green-800 shadow-sm transition-colors group-hover:bg-green-50">
        {cta} <span aria-hidden>→</span>
      </span>
      </span>
    </Link>
  )
}
