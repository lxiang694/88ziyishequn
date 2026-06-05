import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import { DIRECTION_INFO } from '@/lib/quizData'

export const dynamic = 'force-dynamic'

const SITE_URL = 'https://healthec.vercel.app'

export const metadata: Metadata = {
  title: '健康知識專欄',
  description: '40+ 中年健康保養全方位指南——從關節、三高、睡眠到失智預防，由真實生活經驗分享。',
  alternates: { canonical: `${SITE_URL}/health-articles` },
  openGraph: {
    title: '健康知識專欄 | 健康優選',
    description: '40+ 中年健康保養全方位指南——真實生活經驗分享。',
    url: `${SITE_URL}/health-articles`,
    siteName: '健康優選',
    type: 'website',
  },
}

async function getArticles() {
  const { data } = await supabaseAdmin
    .from('health_articles')
    .select('id, slug, title, excerpt, cover_image_url, category_slug, reading_minutes, view_count, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  return data || []
}

export default async function ArticlesListPage() {
  const articles = await getArticles()

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/40 to-white">
      <div className="max-w-5xl mx-auto px-4 py-10">

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            📚 健康知識專欄
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            真實經驗分享，<br className="sm:hidden" />一起健康變老
          </h1>
          <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            40+ 中年保養全方位指南，從生活經驗出發，幫你避開常見的健康地雷
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📝</p>
            <p>文章準備中，敬請期待</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map(article => {
              const dirInfo = article.category_slug ? DIRECTION_INFO[article.category_slug] : null
              return (
                <Link
                  key={article.id}
                  href={`/health-articles/${article.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="aspect-[16/10] bg-gray-100 relative overflow-hidden">
                    {article.cover_image_url ? (
                      <Image
                        src={article.cover_image_url}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">📝</div>
                    )}
                    {dirInfo && (
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-green-800 flex items-center gap-1">
                        <span>{dirInfo.icon}</span>
                        <span>{dirInfo.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="font-bold text-gray-900 text-lg leading-snug mb-2 line-clamp-2 group-hover:text-green-700 transition-colors">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 mb-3">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>📖 約 {article.reading_minutes} 分鐘</span>
                      {article.view_count > 0 && <span>· 👁 {article.view_count} 次閱讀</span>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
