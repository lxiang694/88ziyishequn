'use client'
/**
 * 後台商品管理（列表）。
 *
 * 設計原則：一眼看出三件事 —— 這件賣多少、還有多少貨、前台看不看得到。
 *   • 上方狀態頁籤附數量（全部／上架中／未上架／庫存不足），點了就篩選
 *   • 庫存看「每一個規格」，少於 5 件標橘色、售完標紅色，整列左邊也有色條
 *   • 上架／下架是一個開關，直接點；刪除放在最不顯眼的位置，避免誤按
 */
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { stockAlerts, LOW_STOCK } from '@/lib/adminStock'
import toast from 'react-hot-toast'

type Tab = '' | 'true' | 'false' | 'low' | 'archived'
interface Summary { all: number; published: number; unpublished: number; lowStock: number }
const PAGE_SIZE = 15

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [tab, setTab] = useState<Tab>('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/admin/categories').then(r => r.json()).then(d => { if (d.success) setCategories(d.data) })
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    if (catFilter) params.set('category', catFilter)
    if (tab === 'low') params.set('stock', 'low')
    else if (tab) params.set('published', tab)
    const res = await fetch('/api/admin/products?' + params)
    const d = await res.json()
    if (d.success) { setProducts(d.data); setTotal(d.total); if (d.summary) setSummary(d.summary) }
    setLoading(false)
  }, [search, catFilter, tab, page])

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
    if (!confirm(`刪除商品「${name}」？\n\n・沒有訂單的商品：直接刪除，無法還原\n・已經有人訂過的商品：改為「封存」，從前台與商品列表移除，但保留訂單紀錄，之後可以還原`)) return
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { (d.archived || d.orderCount ? toast : toast.success)(d.message || '商品已刪除', { duration: 6000 }); fetchProducts() }
    else toast.error(d.error || '刪除失敗')
  }

  const handleRestore = async (id: number, name: string) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }),
    })
    const d = await res.json()
    if (d.success) { toast.success(`「${name}」${d.message}`); fetchProducts() } else toast.error(d.error || '還原失敗')
  }

  const switchTab = (t: Tab) => { setTab(t); setPage(1) }
  const filtering = !!(search || catFilter || tab)

  const tabs: { key: Tab; label: string; count?: number; warn?: boolean }[] = [
    { key: '', label: '全部', count: summary?.all },
    { key: 'true', label: '上架中', count: summary?.published },
    { key: 'false', label: '未上架', count: summary?.unpublished },
    { key: 'low', label: '⚠️ 庫存不足', count: summary?.lowStock, warn: !!summary?.lowStock },
    { key: 'archived', label: '已封存' },
  ]

  return (
    <div className="max-w-6xl">
      {/* ── 標題列 ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">商品管理</h1>
          <p className="mt-0.5 text-sm text-gray-500">點商品名稱或「編輯」修改內容；開關直接控制前台顯示</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary px-5 py-2.5 text-base">＋ 新增商品</Link>
      </div>

      {/* ── 庫存提醒 ── */}
      {!!summary?.lowStock && tab !== 'low' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-[15px] font-bold text-amber-900">
            ⚠️ 有 {summary.lowStock} 件商品庫存不足（有規格少於 {LOW_STOCK} 件或已售完），記得補貨
          </p>
          <button onClick={() => switchTab('low')} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600">
            只看這些商品 →
          </button>
        </div>
      )}

      {/* ── 狀態頁籤 ＋ 搜尋 ── */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="商品狀態">
          {tabs.map(t => {
            const on = tab === t.key
            return (
              <button key={t.key || 'all'} role="tab" aria-selected={on} onClick={() => switchTab(t.key)}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  on ? (t.warn ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-800 bg-gray-800 text-white')
                    : t.warn ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                {t.label}{t.count !== undefined && <span className={`ml-1.5 tabular-nums ${on ? 'opacity-90' : 'opacity-70'}`}>{t.count}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">搜尋商品名稱</span>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
            <input className="form-input py-2 pl-10" style={{ height: '44px' }} placeholder="搜尋商品名稱…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </label>
          <select className="form-input w-44" style={{ height: '44px' }} value={catFilter} aria-label="健康方向"
            onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
            <option value="">全部健康方向</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filtering && (
            <button onClick={() => { setSearch(''); setCatFilter(''); setTab(''); setPage(1) }}
              className="rounded-xl border border-gray-200 px-4 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800">清除篩選</button>
          )}
        </div>
      </div>

      {/* ── 商品列表 ── */}
      <div className="card overflow-hidden">
        {/* 欄位標題（電腦） */}
        <div className="hidden grid-cols-[minmax(0,1fr)_9rem_12rem_8rem_8rem] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-[13px] font-bold text-gray-500 md:grid">
          <span>商品</span><span>售價</span><span>庫存</span><span>前台顯示</span><span className="text-right">操作</span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-lg text-gray-500">載入中…</div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-3 text-4xl">{tab === 'low' ? '✅' : '📦'}</div>
            <p className="mb-4 text-lg text-gray-600">
              {tab === 'low' ? '目前沒有庫存不足的商品' : filtering ? '找不到符合條件的商品' : '尚無商品'}
            </p>
            {!filtering && <Link href="/admin/products/new" className="btn-primary px-6 py-2.5 text-base">新增第一個商品</Link>}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {products.map(p => <ProductListRow key={p.id} p={p} onToggle={togglePublish} onDelete={handleDelete} onRestore={handleRestore} />)}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gray-100 p-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">← 上一頁</button>
            <span className="text-sm font-medium text-gray-500">第 {page} / {Math.ceil(total / PAGE_SIZE)} 頁・共 {total} 件</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">下一頁 →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductListRow({ p, onToggle, onDelete, onRestore }: {
  p: any
  onToggle: (id: number, current: boolean) => void
  onDelete: (id: number, name: string) => void
  onRestore: (id: number, name: string) => void
}) {
  const variants: any[] = p.product_variants || []
  const active = variants.filter(v => v.is_active)
  const prices = active.map(v => Number(v.sale_price)).filter(n => n > 0)
  const min = prices.length ? Math.min(...prices) : null
  const max = prices.length ? Math.max(...prices) : null
  const totalStock = active.reduce((s, v) => s + (Number(v.stock_qty) || 0), 0)
  const alerts = stockAlerts(variants)
  const hasOut = alerts.some(a => a.level === 'out')
  const shopCats: any[] = p.shop_categories || []
  const archived = !!p.archived_at

  return (
    <li className={`grid grid-cols-2 gap-x-3 gap-y-2.5 border-l-4 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_9rem_12rem_8rem_8rem] md:items-center md:gap-4 ${
      alerts.length ? (hasOut ? 'border-l-red-400' : 'border-l-amber-400') : 'border-l-transparent'}`}>
      {/* 商品 */}
      <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
        <Link href={`/admin/products/${p.id}`} className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
          {p.cover_image_url
            ? <Image src={p.cover_image_url} alt={p.product_name} fill className="object-cover" sizes="56px" />
            : <span className="flex h-full items-center justify-center text-xl">📦</span>}
        </Link>
        <div className="min-w-0">
          <Link href={`/admin/products/${p.id}`} className="line-clamp-2 font-bold leading-snug text-gray-800 hover:text-green-700">{p.product_name}</Link>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-gray-500">
            {shopCats.map(c => <span key={c.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{c.emoji} {c.name}</span>)}
            <span>{active.length} 種規格</span>
          </p>
        </div>
      </div>

      {/* 售價 */}
      <div className="col-span-2 flex items-baseline gap-2 md:col-span-1 md:block">
        <span className="text-[13px] text-gray-400 md:hidden">售價</span>
        {min !== null
          ? <span className="font-bold tabular-nums text-gray-800">{formatPrice(min)}{max !== min && <span className="font-normal text-gray-500">～{formatPrice(max!)}</span>}</span>
          : <span className="text-sm text-gray-400">未設定</span>}
      </div>

      {/* 庫存：每個規格各自看 */}
      <div className="col-span-2 flex items-start gap-2 md:col-span-1 md:block">
        <span className="pt-0.5 text-[13px] text-gray-400 md:hidden">庫存</span>
        {alerts.length ? (
          <ul className="space-y-1">
            {alerts.slice(0, 3).map(a => (
              <li key={a.name} className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-bold md:flex ${a.level === 'out' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                <span className="truncate">{active.length > 1 ? a.name : ''}</span>
                <span className="flex-shrink-0">{a.level === 'out' ? '售完' : `剩 ${a.qty}`}</span>
              </li>
            ))}
            {alerts.length > 3 && <li className="text-[12px] text-gray-500">還有 {alerts.length - 3} 種規格</li>}
          </ul>
        ) : (
          <span className="text-sm font-semibold text-gray-600">✓ 庫存 <span className="tabular-nums">{totalStock}</span></span>
        )}
      </div>

      {/* 前台顯示：開關 */}
      <div className="flex items-center gap-2">
        {archived ? (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[13px] font-bold text-gray-500">已封存</span>
        ) : (
          <button type="button" role="switch" aria-checked={!!p.is_published} onClick={() => onToggle(p.id, p.is_published)}
            className="group flex items-center gap-2" title={p.is_published ? '點一下下架' : '點一下上架'}>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${p.is_published ? 'bg-green-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.is_published ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
            <span className={`text-[13px] font-bold ${p.is_published ? 'text-green-700' : 'text-gray-500'}`}>{p.is_published ? '上架中' : '未上架'}</span>
          </button>
        )}
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-end gap-2">
        {archived ? (
          <button onClick={() => onRestore(p.id, p.product_name)} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">還原</button>
        ) : <>
          <Link href={`/admin/products/${p.id}`} className="rounded-lg border border-green-600 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-50">編輯</Link>
          <button onClick={() => onDelete(p.id, p.product_name)} className="rounded-lg px-2 py-2 text-sm text-gray-400 hover:bg-red-50 hover:text-red-600" title="刪除商品">刪除</button>
        </>}
      </div>
    </li>
  )
}
