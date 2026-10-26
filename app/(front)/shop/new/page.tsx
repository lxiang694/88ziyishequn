import type { Metadata } from 'next'
import ShopBrowser from '@/components/front/ShopBrowser'
import { fetchShopCategories, fetchShopProducts, NEW_ARRIVALS_SLUG, NEW_ARRIVALS_LIMIT } from '@/lib/shopQuery'
import { SITE_URL } from '@/lib/siteUrl'

// 跟賣場其他頁一樣每 60 秒重新產生；後台上架新商品時 refreshStorefront() 會讓快取立刻更新
export const revalidate = 60

export const metadata: Metadata = {
  title: '新品上市',
  description: '健康優選最新上架的保健食品與養生好物，最新的排在最前面。7-11 門市取貨、免帳號直接下單。',
  alternates: { canonical: `${SITE_URL}/shop/new` },
}

export default async function NewArrivalsPage() {
  const [categories, products] = await Promise.all([
    fetchShopCategories(),
    fetchShopProducts(NEW_ARRIVALS_SLUG),
  ])

  return (
    <ShopBrowser
      categories={categories}
      activeSlug={NEW_ARRIVALS_SLUG}
      initialProducts={products as any}
      heading="✨ 新品上市"
      subheading={`最近上架的 ${NEW_ARRIVALS_LIMIT} 件商品，最新的排在最前面。`}
    />
  )
}
