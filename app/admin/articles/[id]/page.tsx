'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import ArticleEditor from '@/components/admin/ArticleEditor'

export default function EditArticlePage({ params }: { params: { id: string } }) {
  const [article, setArticle] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/articles/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setArticle(d.data)
        setLoading(false)
      })
  }, [params.id])

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-3">
        <Link href="/admin/articles" className="hover:text-green-700">健康知識文章</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700">編輯文章</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯文章</h1>

      {loading ? (
        <div className="card p-16 text-center text-gray-400">載入中...</div>
      ) : !article ? (
        <div className="card p-16 text-center text-gray-400">找不到此文章</div>
      ) : (
        <ArticleEditor initial={article} />
      )}
    </div>
  )
}
