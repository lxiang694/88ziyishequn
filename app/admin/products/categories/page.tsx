'use client'

/**
 * 批次指派商品分類。
 *
 * 新增商品分類之後，站上既有的商品一個都還沒分類 —— 分類頁全是空的。
 * 一件一件進編輯頁補太慢，所以做這一頁：整批列出來、依商品名稱給建議，
 * 一路按下去就好。
 *
 * 建議不會自動套用。分錯類客人就找不到商品，那個決定不該由一段關鍵字
 * 比對代替人做。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

interface Category { id: number; name: string; slug: string; emoji: string }
interface Row {
  id: number
  product_name: string
  cover_image_url: string | null
  is_published: boolean
  category_ids: number[]
  suggestions: { id: number; matched: string[] }[]
}

const button = 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-green-800'
const outline = 'rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40'

export default function BulkCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [picked, setPicked] = useState<Record<number, number[]>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [onlyUnassigned, setOnlyUnassigned] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/products/bulk-categories?unassigned=${onlyUnassigned ? 1 : 0}`, { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok || !d.success) throw new Error(d.error || '讀取失敗')
      setCategories(d.categories)
      setRows(d.data)
      setPicked(Object.fromEntries(d.data.map((r: Row) => [r.id, r.category_ids])))
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [onlyUnassigned])

  useEffect(() => { load() }, [load])

  const toggle = (productId: number, categoryId: number) => {
    setPicked(prev => {
      const current = prev[productId] || []
      return {
        ...prev,
        [productId]: current.includes(categoryId)
          ? current.filter(id => id !== categoryId)
          : [...current, categoryId],
      }
    })
  }

  const applyAllSuggestions = () => {
    setPicked(prev => {
      const next = { ...prev }
      for (const row of rows) {
        if ((next[row.id] || []).length > 0 || row.suggestions.length === 0) continue
        // 只套最有把握的那一個，不要把第二順位也塞進去
        next[row.id] = [row.suggestions[0].id]
      }
      return next
    })
    toast.success('已填入建議，請確認後再儲存')
  }

  // 只送真的改過的，沒動到的商品不要白跑一趟刪除再寫入
  const changed = useMemo(
    () => rows.filter(r => {
      const now = [...(picked[r.id] || [])].sort().join(',')
      return now !== [...r.category_ids].sort().join(',')
    }),
    [rows, picked],
  )

  const save = async () => {
    if (changed.length === 0) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/products/bulk-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: changed.map(r => ({ product_id: r.id, category_ids: picked[r.id] || [] })),
        }),
      })
      const d = await res.json()
      if (!res.ok || !d.success) throw new Error(d.error || '儲存失敗')
      toast.success(`已儲存 ${d.saved} 件`)
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '儲存失敗'
      setError(msg); toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const unassignedCount = rows.filter(r => (picked[r.id] || []).length === 0).length

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-gray-800">批次指派商品分類</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          客人在首頁與頁尾是照商品分類找東西的。沒有分類的商品只會出現在「全部商品」裡，
          照分類逛就找不到它。
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={onlyUnassigned}
            onChange={e => setOnlyUnassigned(e.target.checked)} />
          只看還沒分類的
        </label>
        <button className={outline} onClick={applyAllSuggestions} disabled={loading || saving}>
          全部填入建議
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {loading ? '讀取中…' : `${rows.length} 件${unassignedCount > 0 ? `，${unassignedCount} 件尚未分類` : ''}`}
          </span>
          <button className={button} onClick={save} disabled={saving || changed.length === 0}>
            {saving ? '儲存中…' : changed.length > 0 ? `儲存 ${changed.length} 件變更` : '沒有變更'}
          </button>
        </div>
      </div>

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-gray-600">
          {onlyUnassigned ? '所有商品都已經有分類了 🎉' : '目前沒有商品'}
        </div>
      )}

      <div className="space-y-3">
        {rows.map(row => {
          const mine = picked[row.id] || []
          const suggestionIds = new Set(row.suggestions.map(s => s.id))
          return (
            <article key={row.id} className="rounded-xl border bg-white p-4">
              <div className="mb-3 flex items-start gap-3">
                {row.cover_image_url ? (
                  // 後台縮圖，不需要 next/image 的最佳化（Hobby 方案有額度）
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.cover_image_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300">💊</div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">{row.product_name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {row.is_published ? '已上架' : '未上架'}
                    {mine.length === 0 && <span className="ml-2 font-semibold text-red-600">尚未分類</span>}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const on = mine.includes(cat.id)
                  const suggested = suggestionIds.has(cat.id)
                  return (
                    <button key={cat.id} type="button" onClick={() => toggle(row.id, cat.id)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                        on ? 'border-green-600 bg-green-50 text-green-800'
                          : suggested ? 'border-dashed border-green-400 text-green-700 hover:bg-green-50'
                          : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                      {cat.emoji} {cat.name}
                      {!on && suggested && <span className="ml-1 text-xs">建議</span>}
                    </button>
                  )
                })}
              </div>

              {row.suggestions.length > 0 && mine.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  依據商品名稱裡的「{row.suggestions[0].matched.join('、')}」
                </p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
