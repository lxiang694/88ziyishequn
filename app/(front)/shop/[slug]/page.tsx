import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ShopBrowser from '@/components/front/ShopBrowser'
import { fetchShopCategories, fetchShopProducts } from '@/lib/shopQuery'
import { SITE_URL } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'

async function findCategory(slug: string) {
  const categories = await fetchShopCategories()
  return { categories, category: categories.find(c => c.slug === slug) }
}

export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  const { category } = await findCategory(decodeURIComponent(params.slug))
  if (!category) return { title: '商品分類' }

  return {
    title: category.name,
    description: `${category.description} 7-11 門市取貨、免帳號直接下單。`,
    alternates: { canonical: `${SITE_URL}/shop/${category.slug}` },
    openGraph: {
      title: `${category.name}｜健康優選`,
      description: category.description,
      url: `${SITE_URL}/shop/${category.slug}`,
      siteName: '健康優選',
      locale: 'zh_TW',
      type: 'website',
    },
  }
}

export default async function ShopCategoryPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug)
  const { categories, category } = await findCategory(slug)
  // 不存在的分類給 404，而不是靜靜顯示一個空賣場 —— 網址打錯要看得出來
  if (!category) notFound()

  const products = await fetchShopProducts(slug)

  // 麵包屑結構化資料：讓搜尋結果顯示「健康優選 › 養身茶飲」而不是一串網址
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '全部商品', item: `${SITE_URL}/shop` },
      { '@type': 'ListItem', position: 2, name: category.name, item: `${SITE_URL}/shop/${category.slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ShopBrowser
        categories={categories}
        activeSlug={slug}
        initialProducts={products as any}
        heading={`${category.emoji} ${category.name}`}
        subheading={category.description}
      />
    </>
  )
}
