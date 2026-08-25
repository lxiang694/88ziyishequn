import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const SITE_URL = 'https://healthec.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: products }, { data: articles }] = await Promise.all([
    supabaseAdmin.from('products').select('slug, updated_at').eq('is_published', true),
    supabaseAdmin.from('health_articles').select('slug, updated_at').eq('is_published', true),
  ])

  const productUrls: MetadataRoute.Sitemap = (products || []).map(p => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const articleUrls: MetadataRoute.Sitemap = (articles || []).map(a => ({
    url: `${SITE_URL}/health-articles/${a.slug}`,
    lastModified: new Date(a.updated_at),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/health-quiz`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/sleep-quiz`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/sleep-quiz/psqi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/sleep-quiz/ess`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/sleep-tracker`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/health-articles`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    // 陪診品牌前台
    { url: `${SITE_URL}/care`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/care/assessment`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/care/services`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/care/process`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/care/safety`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/care/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    ...productUrls,
    ...articleUrls,
  ]
}
