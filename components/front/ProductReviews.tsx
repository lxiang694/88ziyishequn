'use client'
import { useCallback, useState } from 'react'
import { Stars } from './StarRating'
import ReviewForm from './ReviewForm'
import { reviewDate, type PublicReview, type ReviewSummary } from '@/lib/reviews'

export interface InitialReviews { ready: boolean; summary: ReviewSummary; reviews: PublicReview[]; hasMore: boolean }

type Filter = 'all' | 1 | 2 | 3 | 4 | 5 | 'verified'

/**
 * 商品評價區：平均分數＋星數分布、依星數篩選、評價列表、寫評價。
 * 第一頁由伺服器先查好（評價文字在第一份 HTML 裡），之後切篩選、載入更多才打 API。
 */
export default function ProductReviews({ productId, productSlug, productName, initial, formOpen, setFormOpen }: {
  productId: number
  productSlug: string
  productName: string
  initial: InitialReviews
  formOpen: boolean
  setFormOpen: (open: boolean) => void
}) {
  const [summary, setSummary] = useState(initial.summary)
  const [reviews, setReviews] = useState(initial.reviews)
  const [hasMore, setHasMore] = useState(initial.hasMore)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (f: Filter, offset: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ product_id: String(productId), offset: String(offset) })
      if (typeof f === 'number') params.set('rating', String(f))
      if (f === 'verified') params.set('verified', '1')
      const d = await (await fetch('/api/reviews?' + params)).json()
      if (!d.success) return
      setSummary(d.summary)
      setReviews(cur => offset ? [...cur, ...d.reviews] : d.reviews)
      setHasMore(d.hasMore)
    } catch {
      // 網路不穩：保留目前的內容
    } finally {
      setLoading(false)
    }
  }, [productId])

  const choose = (f: Filter) => { setFilter(f); load(f, 0) }
  const { count, average, distribution } = summary

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: '全部', n: count },
    ...([5, 4, 3, 2, 1] as const).map(s => ({ key: s as Filter, label: `${s} 星`, n: distribution[s] })),
    ...(summary.verified ? [{ key: 'verified' as Filter, label: '已購買', n: summary.verified }] : []),
  ]

  return (
    <section id="reviews" className="scroll-mt-32 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="reviews-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="reviews-heading" className="text-[19px] font-bold text-gray-900">商品評價{count > 0 && <span className="ml-1.5 text-base font-semibold text-gray-500">({count})</span>}</h2>
        {count > 0 && (
          <button type="button" onClick={() => setFormOpen(true)}
            className="flex-shrink-0 rounded-full border-2 border-green-700 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-50">
            ✏️ 寫評價
          </button>
        )}
      </div>

      {count === 0 ? (
        <div className="rounded-2xl bg-gray-50 px-4 py-8 text-center">
          <Stars value={0} size={28} className="mb-3" />
          <p className="font-bold text-gray-800">還沒有人評價這個商品</p>
          <p className="mt-1 text-[15px] text-gray-600">用過的話，歡迎分享您的心得給其他人參考</p>
          <button type="button" onClick={() => setFormOpen(true)}
            className="mt-4 rounded-xl bg-green-700 px-6 py-3 text-base font-bold text-white hover:bg-green-800">
            ✏️ 寫第一則評價
          </button>
        </div>
      ) : (
        <>
          {/* 平均分數＋星數分布（點長條也能篩選） */}
          <div className="flex items-center gap-5 rounded-2xl bg-amber-50/60 p-4">
            <div className="flex-shrink-0 text-center">
              <p className="text-[40px] font-bold leading-none text-gray-900 tabular-nums">{average.toFixed(1)}</p>
              <Stars value={average} size={16} className="mt-2" />
              <p className="mt-1 text-[13px] text-gray-500">{count} 則評價</p>
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {([5, 4, 3, 2, 1] as const).map(s => (
                <li key={s}>
                  <button type="button" onClick={() => choose(s)} className="flex w-full items-center gap-2 text-[13px] text-gray-600">
                    <span className="w-7 flex-shrink-0 text-right tabular-nums">{s} 星</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${count ? distribution[s] / count * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 flex-shrink-0 text-right tabular-nums">{distribution[s]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 篩選 */}
          <div className="-mx-5 mt-4 overflow-x-auto px-5">
            <div className="flex gap-2 pb-1">
              {chips.map(c => (
                <button key={String(c.key)} type="button" onClick={() => choose(c.key)} disabled={c.n === 0 && c.key !== 'all'}
                  className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors disabled:opacity-40 ${filter === c.key ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>
                  {c.label}<span className="ml-1 tabular-nums">({c.n})</span>
                </button>
              ))}
            </div>
          </div>

          {/* 列表 */}
          <ul className={`mt-2 divide-y divide-gray-100 ${loading && !reviews.length ? 'opacity-50' : ''}`}>
            {reviews.map(r => <ReviewItem key={r.id} review={r} />)}
          </ul>
          {!loading && reviews.length === 0 && <p className="py-8 text-center text-gray-500">這個篩選沒有評價</p>}
          {hasMore && (
            <button type="button" onClick={() => load(filter, reviews.length)} disabled={loading}
              className="mt-3 w-full rounded-xl border border-gray-200 py-3 text-[15px] font-bold text-green-700 hover:bg-green-50 disabled:opacity-50">
              {loading ? '載入中…' : '看更多評價'}
            </button>
          )}
        </>
      )}

      {formOpen && (
        <ReviewForm productId={productId} productSlug={productSlug} productName={productName}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); setFilter('all'); load('all', 0) }} />
      )}
    </section>
  )
}

function ReviewItem({ review: r }: { review: PublicReview }) {
  const [open, setOpen] = useState(false)
  const long = Array.from(r.content).length > 120 || r.content.split('\n').length > 4
  return (
    <li className="py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-[15px] font-bold text-green-800" aria-hidden>
          {Array.from(r.display_name)[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-bold text-gray-800">
            {r.display_name}
            {r.verified_purchase && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[12px] font-bold text-green-700">✓ 已購買</span>}
          </p>
          <p className="flex items-center gap-2 text-[13px] text-gray-500">
            <Stars value={r.rating} size={13} />
            <span className="tabular-nums">{reviewDate(r.created_at)}</span>
          </p>
        </div>
      </div>
      {r.variant_name && <p className="mt-2 text-[13px] text-gray-500">規格：{r.variant_name}</p>}
      {r.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.tags.map(t => <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[13px] text-gray-600">{t}</span>)}
        </div>
      )}
      <p className={`mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-800 ${long && !open ? 'line-clamp-4' : ''}`}>{r.content}</p>
      {long && (
        <button type="button" onClick={() => setOpen(o => !o)} className="mt-1 text-[14px] font-bold text-green-700">
          {open ? '收起' : '看完整內容'}
        </button>
      )}
      {r.admin_reply && (
        <div className="mt-3 rounded-xl bg-gray-50 px-3.5 py-3">
          <p className="text-[13px] font-bold text-gray-700">🏪 店家回覆</p>
          <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-gray-700">{r.admin_reply}</p>
        </div>
      )}
    </li>
  )
}
