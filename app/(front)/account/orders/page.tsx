'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRequireUser } from '@/components/front/UserAuthContext'
import OrderProgress from '@/components/front/account/OrderProgress'
import { useMemberOrders } from '@/components/front/account/useMemberOrders'
import { isActiveOrder, orderStage, type MemberOrder } from '@/lib/memberOrders'
import { formatPrice, formatDateTime } from '@/lib/utils'

type Tab = 'all' | 'active' | 'done' | 'cancelled'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'active', label: '進行中' }, { key: 'done', label: '已完成' }, { key: 'cancelled', label: '已取消' },
]
const inTab = (o: MemberOrder, t: Tab) =>
  t === 'all' || (t === 'active' && isActiveOrder(o)) || (t === 'done' && orderStage(o).done) || (t === 'cancelled' && o.status === '已取消')

/**
 * 我的訂單：一般訂單＋團購訂單，依狀態分頁籤。
 * 每張訂單直接看得到進度條與下一步說明，不用點開；
 * 明細、再買一次、寫評價放在卡片下方。
 */
export default function MemberOrdersPage() {
  const router = useRouter()
  const { user, loading } = useRequireUser()
  const { orders, loading: loadingOrders, reorder, reviewable } = useMemberOrders(!!user)
  const [tab, setTab] = useState<Tab>('all')
  const [open, setOpen] = useState<string | null>(null)
  // 從會員中心的「處理中／已出貨…」點進來時帶 ?tab=，直接停在那一頁籤
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    if (t && TABS.some(x => x.key === t)) setTab(t)
  }, [])

  if (loading || loadingOrders) return <div className="py-20 text-center text-gray-600">載入中...</div>
  if (!user) return null

  const reviewableIds = new Set(reviewable.map(r => r.product_id))
  const list = orders.filter(o => inTab(o, tab))

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-4 pb-6 pt-16 sm:py-10">
        <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/account" className="hover:text-green-700">會員中心</Link><span>›</span><span className="text-gray-700">我的訂單</span>
        </nav>
        <h1 className="mb-4 text-2xl font-bold text-gray-900">我的訂單</h1>

        <div className="sticky top-16 z-10 -mx-4 mb-4 flex border-b border-gray-200 bg-canvas px-4 sm:top-20">
          {TABS.map(t => {
            const n = orders.filter(o => inTab(o, t.key)).length
            return (
              <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'true' : undefined}
                className={`relative flex-1 py-3 text-[15px] font-bold ${tab === t.key ? 'text-green-700' : 'text-gray-500'}`}>
                {t.label}<span className="ml-1 text-[13px] font-semibold">{n}</span>
                {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-green-600" aria-hidden />}
              </button>
            )
          })}
        </div>

        {list.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">{orders.length ? '這裡沒有訂單' : '還沒有訂單'}</p>
            {!orders.length && <Link href="/shop" className="mt-4 inline-block rounded-xl bg-green-700 px-6 py-3 font-bold text-white">去逛逛</Link>}
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map(o => {
              const key = `${o.kind}-${o.id}`
              const expanded = open === key
              const stage = orderStage(o)
              const canReview = o.kind === 'shop' && ['已出貨', '已到店'].includes(o.status) ? o.items.find(i => i.product_id && reviewableIds.has(i.product_id)) : undefined
              const review = canReview ? reviewable.find(r => r.product_id === canReview.product_id) : undefined
              return (
                <li key={key} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                  <div className="p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
                          {o.kind === 'group_buy' && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[12px] font-bold text-sky-800">團購・{o.campaign_title}</span>}
                          <span>{formatDateTime(o.created_at)}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-[13px] text-gray-400">{o.order_no}</p>
                      </div>
                      <p className="flex-shrink-0 text-lg font-bold text-green-700">{formatPrice(o.total)}</p>
                    </div>

                    {/* 商品（前兩樣） */}
                    <ul className="mb-4 space-y-1.5">
                      {o.items.slice(0, expanded ? undefined : 2).map((it, i) => (
                        <li key={i} className="flex items-center gap-3">
                          {o.kind === 'shop' && (
                            <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                              {it.image ? <Image src={it.image} alt="" fill className="object-cover" sizes="44px" /> : <span className="flex h-full items-center justify-center">💊</span>}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 font-semibold text-gray-800">{it.name}</span>
                            <span className="text-[13px] text-gray-500">{it.variant && `${it.variant}・`}× {it.quantity}</span>
                          </span>
                          {expanded && <span className="flex-shrink-0 text-sm text-gray-600">{formatPrice(it.subtotal)}</span>}
                        </li>
                      ))}
                      {!expanded && o.items.length > 2 && <li className="text-[13px] text-gray-500">還有 {o.items.length - 2} 樣商品</li>}
                    </ul>

                    <OrderProgress stage={stage} />

                    {expanded && (
                      <div className="mt-3 space-y-1 rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] text-gray-600">
                        {o.store_name && <p>📍 取貨門市：7-11 {o.store_name}{o.store_area && `（${o.store_area}）`}</p>}
                        <p>📞 取件人手機：{o.phone}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex border-t border-gray-100 text-[15px] font-bold">
                    <button onClick={() => setOpen(expanded ? null : key)} className="flex-1 py-3 text-gray-600 hover:bg-gray-50">{expanded ? '收起' : '看明細'}</button>
                    {o.kind === 'shop' && (
                      <button onClick={() => { if (reorder(o)) router.push('/cart') }} className="flex-1 border-l border-gray-100 py-3 text-green-700 hover:bg-green-50">再買一次</button>
                    )}
                    {review && (
                      <Link href={`/products/${review.slug}#write-review`} className="flex-1 border-l border-gray-100 py-3 text-center text-amber-600 hover:bg-amber-50">寫評價</Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-6 text-center text-[13px] text-gray-500">
          訂單有問題？<a href="https://line.me/ti/p/yJdrshwviU" target="_blank" rel="noopener noreferrer" className="font-bold text-green-700 underline">LINE 客服</a>
        </p>
      </div>
    </div>
  )
}
