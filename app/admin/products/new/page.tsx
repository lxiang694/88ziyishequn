'use client'
import { useRouter } from 'next/navigation'
import ProductForm from '@/components/admin/ProductForm'

export default function NewProductPage() {
  const router = useRouter()
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增商品</h1>
      <ProductForm onSuccess={() => router.push('/admin/products')} />
    </div>
  )
}
