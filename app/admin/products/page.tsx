'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [pubFilter, setPubFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/admin/categories').then(r => r.json()).then(d => { if (d.success) setCategories(d.data) })
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '15' })
    if (search) params.set('search', search)
    if (catFilter) params.set('category', catFilter)
    if (pubFilter) params.set('published', pubFilter)
    const res = await fetch('/api/admin/products?' + params)
    const d = await res.json()
    if (d.success) { setProducts(d.data); setTotal(d.total) }
    setLoading(false)
  }, [search, catFilter, pubFilter, page])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const togglePublish = async (id: number, current: boolean) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current })
    })
    const d = await res.json()
    if (d.success) { toast.success(!current ? '商品已上架' : '商品已下架'); fetchProducts() }
    else toast.error(d.error || '操作失敗')
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`確定刪除商品「${name}」？此操作無法還原。`)) return
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { toast.success('商品已刪除'); fetchProducts() } else toast.error(d.error)
  }

  const resetFilters = () => { setSearch(''); setCatFilter(''); setPubFilter(''); setPage(1) }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">商品管理</h1>
          <p className="text-gray-400 text-sm mt-0.5">共 {total} 件商品</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary py-2.5 px-5 text-base">
          ＋ 新增商品
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <input className="form-input flex-1 min-w-48 py-2" style={{ height: '44px' }}
            placeholder="搜尋商品名稱..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <select className="form-input w-40" style={{ height: '44px' }} value={catFilter}
            onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
            <option value="">全部分類</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-input w-32" style={{ height: '44px' }} value={pubFilter}
            onChange={e => { setPubFilter(e.target.value); setPage(1) }}>
            <option value="">全部狀態</option>
            <option value="true">已上架</option>
            <option value="false">已下架</option>
          </select>
          {(search || catFilter || pubFilter) && (
            <button onClick={resetFilters} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              清除篩選
            </button>
          )}
        </div>
      </div>

      {/* Product list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-lg">載入中...</div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-400 text-lg mb-4">
              {search || catFilter || pubFilter ? '找不到符合條件的商品' : '尚無商品'}
            </p>
            {!search && !catFilter && !pubFilter && (
              <Link href="/admin/products/new" className="btn-primary py-2.5 px-6 text-base">立即新增第一個商品</Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {products.map(p => {
              const variants = p.product_variants || []
              const activeVariants = variants.filter((v: any) => v.is_active)
              const minPrice = activeVariants.length ? Math.min(...activeVariants.map((v: any) => v.sale_price)) : null
              const totalStock = variants.reduce((s: number, v: any) => s + v.stock_qty, 0)
              const cats = p.product_category_relations?.map((r: any) => r.health_categories?.name).filter(Boolean) || []
              const lowStock = totalStock <= 5 && totalStock > 0
              const outOfStock = totalStock === 0

              return (
                <div key={p.id} className="flex gap-4 p-4 hover:bg-gray-50/50 transition-colors items-start">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden relative flex-shrink-0 shadow-sm">
                    {p.cover_image_url
                      ? <Image src={p.cover_image_url} alt={p.product_name} fill className="object-cover" sizes="64px" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">💊</div>}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-bold text-gray-800 text-base">{p.product_name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0
                        ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_published ? '已上架' : '未上架'}
                      </span>
                    </div>
                    {cats.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {cats.map((c: string) => (
                          <span key={c} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm">
                      {minPrice !== null && (
                        <span className="text-green-700 font-bold">{formatPrice(minPrice)} 起</span>
                      )}
                      <span className={`font-semibold ${outOfStock ? 'text-red-500' : lowStock ? 'text-orange-500' : 'text-gray-500'}`}>
                        {outOfStock ? '⚠️ 已售完' : lowStock ? `⚠️ 庫存剩 ${totalStock}` : `庫存 ${totalStock} 件`}
                      </span>
                      <span className="text-gray-400">{variants.length} 規格</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <Link href={`/admin/products/${p.id}`}
                      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-semibold transition-colors text-center">
                      編輯
                    </Link>
                    <button onClick={() => togglePublish(p.id, p.is_published)}
                      className={`text-sm px-3 py-2 rounded-lg font-semibold transition-colors
                        ${p.is_published ? 'bg-orange-50 hover:bg-orange-100 text-orange-700' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}>
                      {p.is_published ? '下架' : '上架'}
                    </button>
                    <button onClick={() => handleDelete(p.id, p.product_name)}
                      className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg font-semibold transition-colors">
                      刪除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {total > 15 && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors">
              ← 上一頁
            </button>
            <span className="text-sm text-gray-500 font-medium">第 {page} / {Math.ceil(total / 15)} 頁</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors">
              下一頁 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
