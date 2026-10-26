'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useUserAuth } from './UserAuthContext'
import { StarInput } from './StarRating'
import { RATING_LABELS, REVIEW_MAX_LENGTH, REVIEW_MIN_LENGTH, REVIEW_TAGS } from '@/lib/reviews'

/**
 * 寫評價（手機從下方滑出、電腦置中）。
 *
 * 沒登入：說明只有會員能寫，給登入／註冊按鈕，登入後回到這個商品的評價區。
 * 已登入：點星星 → 點快速標籤 → 寫心得 → 送出。寫過的會帶入，按了是「更新」。
 */
export default function ReviewForm({ productId, productSlug, productName, onClose, onSaved }: {
  productId: number
  productSlug: string
  productName: string
  onClose: () => void
  onSaved: () => void
}) {
  const { user, loading: authLoading, authedFetch } = useUserAuth()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [existing, setExisting] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [purchased, setPurchased] = useState(false)
  const [loadingMine, setLoadingMine] = useState(false)
  const [saving, setSaving] = useState(false)

  // 關閉時頁面不要跟著捲；按 Esc 關閉
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  // 已登入：帶入自己寫過的評價
  useEffect(() => {
    if (!user) return
    setLoadingMine(true)
    authedFetch(`/api/reviews/mine?product_id=${productId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        setPurchased(!!d.purchased)
        if (d.review) {
          setExisting(true)
          setHidden(d.review.status === 'hidden')
          setRating(d.review.rating)
          setContent(d.review.content)
          setTags(d.review.tags || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMine(false))
  }, [user, productId, authedFetch])

  const length = Array.from(content.trim()).length
  const canSubmit = rating > 0 && length >= REVIEW_MIN_LENGTH && length <= REVIEW_MAX_LENGTH && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await authedFetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, rating, content, tags }),
      })
      const d = await res.json()
      if (!d.success) { toast.error(d.error || '送出失敗'); return }
      toast.success(d.message || '感謝您的評價！')
      onSaved()
    } catch {
      toast.error('網路不穩，請再試一次')
    } finally {
      setSaving(false)
    }
  }

  const next = encodeURIComponent(`/products/${productSlug}#write-review`)
  const toggleTag = (t: string) => setTags(cur => cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="review-form-title" onClick={e => e.stopPropagation()}
        className="bottom-skirt relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:after:hidden sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="review-form-title" className="text-lg font-bold text-gray-900">{existing ? '修改我的評價' : '撰寫評價'}</h2>
            <p className="truncate text-[13px] text-gray-500">{productName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-2xl text-gray-400 hover:bg-gray-100">×</button>
        </div>

        <div className="overflow-y-auto px-5 py-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
          {authLoading ? (
            <p className="py-10 text-center text-gray-500">載入中…</p>
          ) : !user ? (
            <div className="py-4 text-center">
              <div className="mb-3 text-4xl" aria-hidden>🔒</div>
              <p className="text-lg font-bold text-gray-900">登入會員才能撰寫評價</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">為了讓評價真實可信，只開放會員撰寫。<br />註冊免費，1 分鐘完成。</p>
              <div className="mt-5 flex flex-col gap-2.5">
                <Link href={`/login?next=${next}`} className="rounded-xl bg-green-700 py-3.5 text-base font-bold text-white hover:bg-green-800">會員登入</Link>
                <Link href={`/signup?next=${next}`} className="rounded-xl border-2 border-green-700 py-3 text-base font-bold text-green-700 hover:bg-green-50">免費註冊會員</Link>
              </div>
            </div>
          ) : loadingMine ? (
            <p className="py-10 text-center text-gray-500">載入中…</p>
          ) : (
            <div className="space-y-5">
              {hidden && (
                <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900">
                  您之前的評價目前沒有公開顯示。修改後仍需經過店家確認才會再顯示。
                </p>
              )}
              <div className="text-center">
                <p className="mb-2 font-bold text-gray-800">您給這個商品幾顆星？</p>
                <StarInput value={rating} onChange={setRating} />
                <p className={`mt-1.5 h-6 text-[15px] font-bold ${rating ? 'text-amber-600' : 'text-gray-400'}`}>
                  {rating ? RATING_LABELS[rating] : '點星星評分'}
                </p>
              </div>

              <div>
                <p className="mb-2 font-bold text-gray-800">快速標籤 <span className="text-[13px] font-normal text-gray-500">（可複選，非必填）</span></p>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_TAGS.map(t => {
                    const on = tags.includes(t)
                    return (
                      <button key={t} type="button" onClick={() => toggleTag(t)} aria-pressed={on}
                        className={`rounded-full border px-3.5 py-2 text-[14px] font-semibold transition-colors ${on ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                        {on && '✓ '}{t}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block font-bold text-gray-800">使用心得</span>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} maxLength={REVIEW_MAX_LENGTH + 20}
                  placeholder="分享您的使用感受，例如口感、使用多久、適合什麼樣的人…"
                  className="w-full resize-none rounded-xl border-2 border-gray-200 p-3 text-base leading-relaxed focus:border-green-500 focus:outline-none" />
                <span className={`mt-1 flex justify-between text-[13px] ${length > REVIEW_MAX_LENGTH ? 'text-red-600' : 'text-gray-500'}`}>
                  <span>{length < REVIEW_MIN_LENGTH ? `至少 ${REVIEW_MIN_LENGTH} 個字` : purchased ? '✓ 您買過這個商品，評價會標示「已購買」' : ''}</span>
                  <span className="tabular-nums">{length}/{REVIEW_MAX_LENGTH}</span>
                </span>
              </label>

              <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] leading-relaxed text-gray-600">
                評價會公開顯示，名字會自動遮蔽（例如「王*明」）。請分享個人使用感受，勿描述療效或留下電話、連結；不當內容店家會隱藏。
              </p>

              <button type="button" onClick={submit} disabled={!canSubmit}
                className="w-full rounded-xl bg-green-700 py-3.5 text-base font-bold text-white transition-colors hover:bg-green-800 disabled:opacity-40">
                {saving ? '送出中…' : existing ? '更新評價' : '送出評價'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
