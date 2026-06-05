'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

  if (loading) return <div className="py-16 text-center text-gray-400">載入中...</div>
  if (!product) return <div className="py-16 text-center text-gray-500">商品不存在</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">編輯商品</h1>
      <ProductForm initialData={product} productId={parseInt(params.id)} onSuccess={() => router.push('/admin/products')} />
    </div>
  )
}
