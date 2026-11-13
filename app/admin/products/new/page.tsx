'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProductForm from '@/components/admin/ProductForm'

export default function NewProductPage() {
  const router = useRouter()
  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/products" className="text-sm font-semibold text-gray-500 hover:text-green-700">← 商品列表</Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-800">新增商品</h1>
      </div>
      <ProductForm onSuccess={() => router.push('/admin/products')} />
    </div>
  )
}
