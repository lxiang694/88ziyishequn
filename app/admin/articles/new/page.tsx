'use client'
import Link from 'next/link'
import ArticleEditor from '@/components/admin/ArticleEditor'

export default function NewArticlePage() {
  return (
    <div>
      <nav className="text-sm text-gray-500 mb-3">
        <Link href="/admin/articles" className="hover:text-green-700">健康知識文章</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700">新增文章</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增文章</h1>
      <ArticleEditor />
    </div>
  )
}
