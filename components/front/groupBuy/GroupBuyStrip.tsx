'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { campaignPhase } from '@/lib/groupBuy/domain'
import type { CampaignTeaser } from '@/lib/groupBuy/repo'

/**
 * 團購細長條（首頁最上面、商品分類頁搜尋列下面）：只有「開團中」才出現，
 * 寫剩幾天，點了到團購頁。比大橫幅省下大半個畫面，商品可以往上排。
 * 狀態在客人手機上即時算（首頁快取 60 秒，不能在伺服器算好）。
 */
export default function GroupBuyStrip({ campaign }: { campaign: CampaignTeaser | null }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  if (!campaign || !now || campaignPhase(campaign, now) !== 'open') return null
  const ms = new Date(campaign.ends_at).getTime() - now.getTime()
  const h = Math.floor(ms / 3600_000)
  const left = h >= 24 ? `剩 ${Math.floor(h / 24)} 天` : h >= 1 ? `剩 ${h} 小時` : '即將截單'
  return (
    <Link href="/group-buy" className="flex items-center justify-center gap-2 bg-[#214e39] px-4 py-2 text-[14px] font-semibold text-white">
      <span className="truncate">🔥 每月團購開團中・{left}</span>
      <span className="flex-shrink-0 rounded-full bg-amber-300 px-2.5 py-0.5 text-[13px] font-bold text-amber-950">看看 →</span>
    </Link>
  )
}
