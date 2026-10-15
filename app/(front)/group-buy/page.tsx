import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentCampaignSlug } from '@/lib/groupBuy/repo'

// 每 60 秒重新判斷一次「現在是哪一檔」；查詢走快取用戶端（見 lib/supabase.ts 的 supabaseStorefront）
export const revalidate = 60

export const metadata: Metadata = {
  title: '每月團購',
  description: '健康優選每月一檔團購：限時開團、截單後統一出貨，7-11 冷凍取貨付款或黑貓冷凍宅配。',
}

/** /group-buy：直接帶到現在這一檔，方便貼在 LINE 群組，不用每個月換連結 */
export default async function GroupBuyIndex() {
  const slug = await currentCampaignSlug()
  if (slug) redirect(`/group-buy/${slug}`)
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-16 text-center">
      <p className="text-5xl" aria-hidden>🧊</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">目前沒有開團</h1>
      <p className="mt-2 text-gray-600 leading-relaxed">每月開團一次，開團時會在 LINE 通知。</p>
      <a href="https://line.me/ti/p/yJdrshwviU" target="_blank" rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[#06C755] px-6 font-bold text-white">
        加 LINE 收開團通知
      </a>
      <p className="mt-6"><Link href="/" className="font-bold text-green-700">← 回首頁逛逛</Link></p>
    </div>
  )
}
