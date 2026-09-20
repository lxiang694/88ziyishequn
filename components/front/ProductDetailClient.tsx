'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ProductDetail from './ProductDetail'

/**
 * initialProduct 由伺服器先查好傳進來，商品內容才會出現在第一份 HTML
 * 裡（搜尋引擎、LINE/FB 預覽、關閉 JS 的情況都讀得到）。
 * 沒有傳時退回原本的前端抓取，不影響其他呼叫端。
 */
export default function ProductDetailClient({ slug, initialProduct = null }: {
  slug: string
  initialProduct?: any | null
}) {
  const [product, setProduct] = useState<any>(initialProduct)
  const [loading, setLoading] = useState(!initialProduct)

  useEffect(() => {
    // 伺服器已經給了資料就不必再打一次 API
    if (initialProduct) return
    fetch(`/api/products/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setProduct(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug, initialProduct])

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
        <div className="aspect-square bg-gray-200 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )

  if (!product) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-4">😔</div>
      <p className="text-xl text-gray-600 mb-6">商品不存在或已下架</p>
      <Link href="/" className="btn-primary">回首頁</Link>
    </div>
  )

  return <ProductDetail product={product} />
}
