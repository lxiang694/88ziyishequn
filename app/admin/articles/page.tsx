'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { formatDateTime } from '@/lib/utils'

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/articles')
    const d = await res.json()
    if (d.success) setArticles(d.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const togglePublish = async (id: number, current: boolean) => {
    const res = await fetch(`/api/admin/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    const d = await res.json()
    if (d.success) { toast.success(!current ? '已發布' : '已下架'); load() }
    else toast.error(d.error)
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`確定刪除文章「${title}」？此操作無法還原。`)) return
    const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { toast.success('已刪除'); load() }
    else toast.error(d.error)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">健康知識文章</h1>
          <p className="text-gray-400 text-sm mt-0.5">共 {articles.length} 篇</p>
        </div>
        <Link href="/admin/articles/new" className="btn-primary">+ 新增文章</Link>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">載入中...</div>
      ) : articles.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-3">📝</div>
          <p className="text-gray-500 text-lg mb-4">還沒有任何文章</p>
          <Link href="/admin/articles/new" className="btn-primary inline-flex">建立第一篇文章</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map(article => (
            <div key={article.id} className="card overflow-hidden flex flex-col">
              <div className="aspect-[16/9] bg-gray-100 relative">
                {article.cover_image_url ? (
                  <Image src={article.cover_image_url} alt={article.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">📝</div>
                )}
                {!article.is_published && (
                  <div className="absolute top-2 left-2 bg-gray-700/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    草稿
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-base leading-snug mb-1.5 line-clamp-2">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <span>📖 {article.reading_minutes} 分鐘</span>
                  <span>·</span>
                  <span>👁 {article.view_count}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{formatDateTime(article.created_at)}</p>
                <div className="mt-auto flex gap-2">
                  <Link
                    href={`/admin/articles/${article.id}`}
                    className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-sm transition-colors"
                  >編輯</Link>
                  <button
                    onClick={() => togglePublish(article.id, article.is_published)}
                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 font-bold py-2 rounded-xl text-sm transition-colors"
                  >
                    {article.is_published ? '下架' : '發布'}
                  </button>
                  <button
                    onClick={() => handleDelete(article.id, article.title)}
                    className="px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-colors"
                    title="刪除"
                  >🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
