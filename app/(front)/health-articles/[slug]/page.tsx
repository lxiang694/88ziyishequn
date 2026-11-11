import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import { renderArticle } from '@/lib/articleRenderer'
import { DIRECTION_INFO } from '@/lib/quizData'
import { rankArticleProducts } from '@/lib/articleProductMatcher'
import { buildSalesMap } from '@/lib/salesUtils'
import SocialShareButtons from '@/components/front/SocialShareButtons'
import ProductRecommendations from '@/components/front/ProductRecommendations'
import LoginPrompt from '@/components/front/LoginPrompt'
import ArticleAudioPlayer from '@/components/front/ArticleAudioPlayer'
import { SITE_URL } from '@/lib/siteUrl'
import { jsonLdHtml } from '@/lib/jsonLd'

export const dynamic = 'force-dynamic'


const getArticle = cache(async (slug: string) => {
  const { data } = await supabaseAdmin
    .from('health_articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  return data
})

const getRelatedProducts = cache(async (categorySlug: string | null) => {
  if (!categorySlug) return []
  const { data: relations } = await supabaseAdmin
    .from('product_category_relations')
    .select('product_id, health_categories!inner(slug)')
    .eq('health_categories.slug', categorySlug)
    .limit(100)
  const productIds = (relations || []).map((r: any) => r.product_id)
  if (productIds.length === 0) return []

  const [{ data: products }, salesMap] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select(`
        id, product_name, slug, short_intro, ingredients, cover_image_url, created_at,
        product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, sort_order, is_active)
      `)
      .eq('is_published', true)
      .in('id', productIds),
    buildSalesMap(),  // automatically excludes cancelled orders
  ])

  // Smart scoring: keyword match + sales + recency + stock availability
  const ranked = rankArticleProducts(products || [], salesMap, categorySlug, 4)
  // 規格依後台排序，選規格面板的順序才對
  for (const r of ranked) r.product.product_variants?.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return ranked
})

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const article = await getArticle(params.slug)
  if (!article) return { title: '文章不存在' }

  const description = article.excerpt || article.title
  const images = article.cover_image_url
    ? [{ url: article.cover_image_url, width: 1200, height: 630, alt: article.title }]
    : []

  return {
    title: article.title,
    description,
    alternates: { canonical: `${SITE_URL}/health-articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description,
      url: `${SITE_URL}/health-articles/${article.slug}`,
      siteName: '健康優選',
      images,
      locale: 'zh_TW',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: article.cover_image_url ? [article.cover_image_url] : [],
    },
  }
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug)
  if (!article) notFound()

  const relatedProducts = await getRelatedProducts(article.category_slug)
  const dirInfo = article.category_slug ? DIRECTION_INFO[article.category_slug] : null
  const articleUrl = `${SITE_URL}/health-articles/${article.slug}`

  // Increment view count async
  supabaseAdmin
    .from('health_articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', article.id)
    .then(() => {})

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt || undefined,
    image: article.cover_image_url || undefined,
    datePublished: article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: '健康優選' },
    publisher: {
      '@type': 'Organization',
      name: '健康優選',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
  }

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-green-700">首頁</Link>
          <span>›</span>
          <Link href="/health-articles" className="hover:text-green-700">健康知識</Link>
          <span>›</span>
          <span className="text-gray-700 line-clamp-1">{article.title}</span>
        </nav>

        {/* Category badge */}
        {dirInfo && (
          <Link
            href={`/?category=${article.category_slug}`}
            className="inline-flex items-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-800 px-4 py-1.5 rounded-full text-sm font-bold mb-5 transition-colors"
          >
            <span>{dirInfo.icon}</span>
            <span>{dirInfo.name}</span>
          </Link>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
          {article.title}
        </h1>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-gray-600 text-lg leading-relaxed mb-6 pb-6 border-b border-gray-100">
            {article.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-gray-600 mb-8">
          <span>📖 約 {article.reading_minutes} 分鐘</span>
          {article.view_count > 0 && <span>· 👁 {article.view_count} 次閱讀</span>}
        </div>

        {/* Cover image */}
        {article.cover_image_url && (
          <div className="aspect-[16/9] bg-gray-100 rounded-2xl overflow-hidden relative mb-8">
            <Image
              src={article.cover_image_url}
              alt={article.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        {/* Audio player */}
        <ArticleAudioPlayer title={article.title} content={article.content} />

        {/* Content */}
        <article className="prose-article">
          {renderArticle(article.content)}
        </article>

        {/* Share buttons — LINE + Facebook + Copy */}
        <SocialShareButtons
          url={articleUrl}
          title={article.title}
          heading="把這篇分享給家人朋友"
          subtext="一起重視健康"
          theme="green"
        />

        {/* Login prompt — compact, after share */}
        <LoginPrompt
          theme="green"
          compact
          title="加入會員享更多服務"
          message="訂單追蹤、結帳自動填表、再買一次"
          next={`/health-articles/${article.slug}`}
        />

        {/* 相關商品：依文章主題的關鍵成分挑選。手機兩欄小卡，一屏看得到兩件，可直接加入購物車 */}
        {relatedProducts.length > 0 && (
          <div className="mb-8 mt-10 rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 px-3 pb-4 pt-5 sm:p-6">
            <ProductRecommendations
              className=""
              heading={dirInfo ? `${dirInfo.name}・推薦商品` : '推薦商品'}
              subtitle="依這篇文章提到的關鍵成分挑選"
              desktopCols={relatedProducts.length >= 4 ? 4 : 3}
              items={relatedProducts.map(({ product, reason, isNew }) => ({
                // 圖片上已有「新品」標籤，綠色小字就不再重複
                product, note: `🎯 ${reason.replace(/^新品上架\s*·\s*/, '')}`, badge: isNew ? '✨ 新品' : null,
              }))}
            />
            <Link href="/shop" className="mt-4 flex items-center justify-center gap-1 text-sm font-bold text-green-700 hover:text-green-800">
              查看更多商品 →
            </Link>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 my-8 text-center">
          <p className="text-sm text-amber-700 font-semibold mb-1">⚠️ 健康聲明</p>
          <p className="text-[13px] text-amber-600 leading-relaxed">
            本文內容僅供生活保健參考，所有保健品補充請先諮詢您的主治醫師。
            本網站所有商品非藥品，不具備診斷、治療或預防疾病之效果。
          </p>
        </div>

        {/* Back to list */}
        <div className="text-center mt-10">
          <Link
            href="/health-articles"
            className="inline-flex items-center gap-2 border-2 border-gray-200 hover:border-green-400 text-gray-600 hover:text-green-700 font-bold py-3 px-6 rounded-2xl transition-colors"
          >
            ← 看更多健康知識
          </Link>
        </div>
      </div>
    </div>
  )
}
