'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Stars } from '@/components/front/StarRating'
import { formatDateTime } from '@/lib/utils'

interface Review {
  id: number
  product_id: number
  display_name: string
  rating: number
  content: string
  tags: string[]
  variant_name: string | null
  verified_purchase: boolean
  status: 'published' | 'hidden'
  admin_reply: string | null
  admin_reply_at: string | null
  created_at: string
  updated_at: string
  products: { product_name: string; slug: string } | null
}

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'unreplied', label: '未回覆' },
  { key: 'low', label: '1～2 星' },
  { key: 'hidden', label: '已隱藏' },
] as const

/**
 * 後台：商品評價管理。
 * 會員寫完評價直接公開；這裡看新評價、回覆（前台顯示「店家回覆」）、
 * 隱藏不當內容（廣告、療效宣稱、個資），必要時刪除。
 */
export default function AdminReviewsPage() {
  const [rows, setRows] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(30)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('')
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(true)
  const [replying, setReplying] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (filter === 'unreplied') params.set('unreplied', '1')
    if (filter === 'hidden') params.set('status', 'hidden')
    if (filter === 'low') params.set('low', '1')
    try {
      const d = await (await fetch('/api/admin/reviews?' + params)).json()
      if (d.success) {
        setRows(d.data); setTotal(d.total); setPageSize(d.pageSize); setReady(d.ready)
      } else toast.error(d.error || '讀取失敗')
    } catch { toast.error('讀取失敗') }
    setLoading(false)
  }, [page, filter])
  useEffect(() => { load() }, [load])

  const patch = async (id: number, body: object, ok: string) => {
    const d = await (await fetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
    if (d.success) { toast.success(ok); load() } else toast.error(d.error || '操作失敗')
  }
  const remove = async (r: Review) => {
    if (!confirm(`永久刪除 ${r.display_name} 的評價？刪除後無法還原。\n\n一般建議用「隱藏」就好。`)) return
    const d = await (await fetch(`/api/admin/reviews/${r.id}`, { method: 'DELETE' })).json()
    if (d.success) { toast.success('已刪除'); load() } else toast.error(d.error || '刪除失敗')
  }
  const saveReply = async (r: Review) => {
    await patch(r.id, { reply: replyText }, replyText.trim() ? '已回覆，前台會顯示「店家回覆」' : '已移除回覆')
    setReplying(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-800">商品評價</h1>
        <p className="text-[13px] text-gray-600">會員寫完直接公開；不當內容請按「隱藏」</p>
      </div>

      {!ready && (
        <div className="card mb-4 border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          評價功能尚未啟用：請到 Supabase → SQL Editor 執行 <code className="font-mono">migrations/product_reviews.sql</code>。
        </div>
      )}

      <div className="card mb-4 flex flex-wrap gap-2 p-4">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1) }}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${filter === f.key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-sm text-gray-500">共 {total} 則</span>
      </div>

      {loading ? (
        <p className="py-16 text-center text-gray-600">載入中...</p>
      ) : rows.length === 0 ? (
        <p className="card py-16 text-center text-gray-600">沒有符合的評價</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => (
            <li key={r.id} className={`card p-4 ${r.status === 'hidden' ? 'opacity-70' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {r.products && (
                    <Link href={`/products/${r.products.slug}#reviews`} target="_blank" className="text-sm font-bold text-green-700 hover:underline">
                      {r.products.product_name} ↗
                    </Link>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <Stars value={r.rating} size={15} />
                    <b className="text-gray-800">{r.display_name}</b>
                    {r.verified_purchase && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[12px] font-bold text-green-700">已購買</span>}
                    {r.status === 'hidden' && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[12px] font-bold text-gray-700">已隱藏</span>}
                    <span className="text-gray-500">{formatDateTime(r.created_at)}</span>
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button onClick={() => { setReplying(r.id); setReplyText(r.admin_reply || '') }}
                    className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-bold text-green-700 hover:bg-green-50">
                    {r.admin_reply ? '修改回覆' : '回覆'}
                  </button>
                  {r.status === 'published' ? (
                    <button onClick={() => patch(r.id, { status: 'hidden' }, '已隱藏，前台不再顯示')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50">隱藏</button>
                  ) : (
                    <button onClick={() => patch(r.id, { status: 'published' }, '已重新公開')}
                      className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50">公開</button>
                  )}
                  <button onClick={() => remove(r)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50">刪除</button>
                </div>
              </div>
              {(r.variant_name || r.tags.length > 0) && (
                <p className="mt-2 flex flex-wrap gap-1.5 text-[13px] text-gray-600">
                  {r.variant_name && <span>規格：{r.variant_name}</span>}
                  {r.tags.map(t => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5">{t}</span>)}
                </p>
              )}
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-800">{r.content}</p>

              {replying === r.id ? (
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} maxLength={500} autoFocus
                    placeholder="以店家身分回覆，例如感謝分享、使用提醒…（清空後儲存＝移除回覆）"
                    className="form-input w-full resize-none" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setReplying(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">取消</button>
                    <button onClick={() => saveReply(r)} className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-bold text-white">儲存回覆</button>
                  </div>
                </div>
              ) : r.admin_reply && (
                <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                  <b className="text-gray-700">🏪 店家回覆</b>
                  <p className="mt-1 whitespace-pre-line text-gray-700">{r.admin_reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {total > pageSize && (
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">上一頁</button>
          <span className="self-center text-sm text-gray-600">第 {page} 頁</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">下一頁</button>
        </div>
      )}
    </div>
  )
}
