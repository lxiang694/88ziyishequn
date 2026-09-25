import type { Metadata } from 'next'
import ShopBrowser from '@/components/front/ShopBrowser'
import { fetchShopCategories, fetchShopProducts } from '@/lib/shopQuery'
import { SITE_URL } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '全部商品',
  description: '健康優選全部商品：營養支持、養身茶飲、健康零食、個護敷貼、足浴香囊、養生膏方、傳統滋補、外用草本保養與居家生活。7-11 門市取貨、免帳號直接下單。',
  alternates: { canonical: `${SITE_URL}/shop` },
}

export default async function ShopPage() {
  const [categories, products] = await Promise.all([
    fetchShopCategories(),
    fetchShopProducts(''),
  ])

  return (
    <ShopBrowser
      categories={categories}
      activeSlug=""
      initialProducts={products as any}
      heading="全部商品"
      subheading="選一個分類，或直接在上面搜尋。"
    />
  )
}
