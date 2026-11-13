'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProductForm from '@/components/admin/ProductForm'

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/products/${params.id}`).then(r => r.json()).then(d => {
      if (d.success) setProduct(d.data)
      setLoading(false)
    })
  }, [params.id])

  if (loading) return <div className="py-16 text-center text-gray-600">載入中...</div>
  if (!product) return <div className="py-16 text-center text-gray-500">商品不存在</div>

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/products" className="text-sm font-semibold text-gray-500 hover:text-green-700">← 商品列表</Link>
          <h1 className="mt-1 truncate text-2xl font-bold text-gray-800">編輯：{product.product_name}</h1>
        </div>
        {product.slug && (
          <a href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">在前台查看 ↗</a>
        )}
      </div>
      <ProductForm initialData={product} productId={parseInt(params.id)} onSuccess={() => router.push('/admin/products')} />
    </div>
  )
}
