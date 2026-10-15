import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPublicCampaign } from '@/lib/groupBuy/repo'
import { SITE_URL } from '@/lib/siteUrl'
import GroupBuyClient from '@/components/front/groupBuy/GroupBuyClient'

// 每 60 秒重新產生；已售數量與跟團人數最多慢 60 秒（下單時資料庫會即時檢查限量）。
// 有人下單、後台儲存檔期時會立刻更新這一頁。
export const revalidate = 60
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadPublicCampaign(params.slug)
  if (!data) return { title: '團購' }
  const { campaign, items } = data
  const image = campaign.cover_image_url || items.find(i => i.image_url)?.image_url || undefined
  const description = campaign.subtitle || `${campaign.title}：限時團購，截單後統一出貨。`
  return {
    title: campaign.title,
    description,
    alternates: { canonical: `${SITE_URL}/group-buy/${campaign.slug}` },
    openGraph: {
      title: campaign.title, description, url: `${SITE_URL}/group-buy/${campaign.slug}`,
      siteName: '健康優選', locale: 'zh_TW', type: 'website',
      images: image ? [{ url: image, width: 1200, height: 1200, alt: campaign.title }] : [],
    },
  }
}

export default async function GroupBuyPage({ params }: { params: { slug: string } }) {
  const data = await loadPublicCampaign(params.slug)
  if (!data) notFound()
  return <GroupBuyClient data={data} />
}
