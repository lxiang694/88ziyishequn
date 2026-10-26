'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import StorePickerModal, { type Store } from '@/components/front/StorePickerModal'
import {
  campaignPhase, checkoutProblem, enabledMethods, formatTwDateTime, isStorePickup, methodFee, shippingFee,
  DELIVERY_TIMES, SHIPPING_LABEL, SHIPPING_SHORT, type ShippingMethod,
} from '@/lib/groupBuy/domain'
import type { PublicCampaign, PublicItem } from '@/lib/groupBuy/repo'
import { Collapsible, GroupBuyText } from './GroupBuyText'

const money = (n: number) => `$${n.toLocaleString('zh-TW')}`
const LINE_URL = 'https://line.me/ti/p/yJdrshwviU'

/** 倒數：3 天 04:12:09 */
function countdown(ms: number) {
  if (ms <= 0) return '0 秒'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')
  return d > 0 ? `${d} 天 ${hms}` : hms
}

/** 購物籃存在這個瀏覽器，跟一般購物車分開；每一檔各自一份 */
function useBasket(slug: string) {
  const key = `gb-basket:${slug}`
  const [qty, setQty] = useState<Record<number, number>>({})
  useEffect(() => {
    try { setQty(JSON.parse(localStorage.getItem(key) || '{}') || {}) } catch {}
  }, [key])
  const update = (next: Record<number, number>) => {
    setQty(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
  }
  return [qty, update] as const
}

export default function GroupBuyClient({ data }: { data: PublicCampaign }) {
  const { campaign, items, buyers } = data
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  // 伺服器產生的頁面可能快取了 60 秒；階段以客人手機上的時間為準，下單時資料庫會再檢查一次
  const phase = campaignPhase(campaign, now ?? new Date(campaign.starts_at))
  const isOpen = now !== null && phase === 'open'

  const [qty, setQty] = useBasket(campaign.slug)
  const [checkingOut, setCheckingOut] = useState(false)
  const [placed, setPlaced] = useState<Placed | null>(null)

  const lines = items.filter(i => (qty[i.id] || 0) > 0).map(i => ({ item: i, quantity: qty[i.id] }))
  const count = lines.reduce((s, l) => s + l.quantity, 0)
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.quantity, 0)
  const methods = enabledMethods(campaign)

  const setItemQty = (item: PublicItem, n: number) => {
    const cap = Math.min(item.remaining ?? 999, item.per_person_limit ?? 999, 999)
    const v = Math.max(0, Math.min(n, cap))
    if (n > cap && cap > 0) toast(item.per_person_limit && cap === item.per_person_limit ? `每人限購 ${cap} 件` : `只剩 ${cap} 件`)
    setQty({ ...qty, [item.id]: v })
  }

  if (placed) {
    return <OrderPlaced placed={placed} campaign={campaign} />
  }

  // 運費提示：有運費的取貨方式時才提「再買多少免運」
  const maxFee = Math.max(0, ...methods.map(m => methodFee(campaign, m)))
  const freeAt = campaign.free_shipping_threshold
  const freeHint = freeAt != null && maxFee > 0 && count > 0
    ? (subtotal >= freeAt ? '🎉 已達免運' : `再買 ${money(freeAt - subtotal)} 免運`) : null
  const hasFrozen = methods.includes('711') || methods.includes('home')
  const payText = [methods.some(isStorePickup) && '7-11 取貨時付款', methods.includes('home') && '黑貓宅配到府時付款'].filter(Boolean).join('、')

  const infoRows: { icon: string; label: string; value: React.ReactNode }[] = [
    ...(campaign.ship_note ? [{ icon: '📦', label: '出貨', value: campaign.ship_note }] : []),
    ...methods.map(m => {
      const fee = methodFee(campaign, m)
      return { icon: m === 'home' ? '🚚' : m === '711' ? '🧊' : '🏪', label: '取貨', value: <>{SHIPPING_LABEL[m]}<span className="ml-1.5 text-gray-500">{fee ? `運費 ${money(fee)}` : '免運費'}</span></> }
    }),
    ...(freeAt != null && maxFee > 0 ? [{ icon: '🎁', label: '免運', value: `滿 ${money(freeAt)} 免運` }] : []),
    { icon: '💰', label: '付款', value: `${payText}，不用先轉帳` },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-14 md:pt-6">
      {/* ── 檔期標題與倒數 ───────────────────────────── */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        {campaign.cover_image_url && (
          <div className="relative aspect-[16/9] bg-sage">
            <Image src={campaign.cover_image_url} alt={campaign.title} fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
          </div>
        )}
        <div className="p-5">
          {now !== null && (
            <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold ${
              phase === 'open' ? 'bg-red-50 text-red-600' : phase === 'upcoming' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
              {phase === 'open' ? '🔥 開團中' : phase === 'upcoming' ? '⏰ 即將開團' : '本檔已截單'}
            </span>
          )}
          <h1 className="mt-2 text-[24px] font-bold leading-snug text-gray-900 sm:text-3xl">{campaign.title}</h1>
          {campaign.subtitle && <p className="mt-2 text-[16px] leading-[1.8] text-gray-600">{campaign.subtitle}</p>}

          <div className={`mt-4 rounded-2xl px-4 py-3 ${now === null || phase === 'open' ? 'bg-red-600 text-white' : 'bg-sage text-gray-800'}`}>
            <p className="text-sm font-semibold opacity-90">{phase === 'upcoming' ? '距離開團' : phase === 'closed' ? '團購狀態' : '距離截單'}</p>
            <p className="text-2xl font-bold tabular-nums">
              {now === null ? '—' : phase === 'open' ? countdown(new Date(campaign.ends_at).getTime() - now.getTime())
                : phase === 'upcoming' ? countdown(new Date(campaign.starts_at).getTime() - now.getTime()) : '已截單，感謝跟團'}
            </p>
            <p className="mt-0.5 text-[13px] opacity-90">
              開團 {formatTwDateTime(campaign.starts_at)} ～ 截單 {formatTwDateTime(campaign.ends_at)}
            </p>
          </div>

          {/* 出貨、取貨、付款：左邊固定寬度的標籤，掃一眼就找到 */}
          <dl className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100 text-[15px]">
            {infoRows.map((r, i) => (
              <div key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                <dt className="flex w-[4.5rem] flex-shrink-0 items-center gap-1.5 font-bold text-gray-500"><span aria-hidden>{r.icon}</span>{r.label}</dt>
                <dd className="min-w-0 flex-1 leading-relaxed text-gray-900">{r.value}</dd>
              </div>
            ))}
          </dl>
          {buyers >= 3 && <p className="mt-3 text-center text-[15px] font-bold text-red-600">👥 已有 {buyers} 人跟團</p>}
        </div>
      </section>

      {/* ── 怎麼跟團 ─────────────────────────────── */}
      <section className="mt-4 rounded-3xl bg-white px-4 py-4 shadow-sm" aria-label="怎麼跟團">
        <h2 className="text-center text-[15px] font-bold text-gray-500">跟團只要 3 步</h2>
        <ol className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['🛒', '選商品數量'], ['📝', '填收件資料'], [methods.some(isStorePickup) ? '🏪' : '🚚', '取貨時付款']].map(([icon, t], i) => (
            <li key={t} className="relative rounded-2xl bg-canvas px-1 py-3">
              <span className="absolute left-2 top-1.5 text-[12px] font-bold text-green-700">{i + 1}</span>
              <span className="block text-[26px] leading-none" aria-hidden>{icon}</span>
              <span className="mt-1.5 block text-[14px] font-bold text-gray-800">{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 商品 ───────────────────────────────────── */}
      <section className="mt-5 space-y-5" aria-label="團購商品">
        {items.map(item => {
          const soldOut = item.remaining === 0
          const q = qty[item.id] || 0
          const cap = Math.min(item.remaining ?? 999, item.per_person_limit ?? 999, 999)
          const save = item.original_price != null && item.original_price > item.price ? item.original_price - item.price : 0
          return (
            <article key={item.id} className={`overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow ${q > 0 ? 'ring-2 ring-green-600' : ''}`}>
              {item.image_url && (
                <div className="relative aspect-square bg-white">
                  <Image src={item.image_url} alt={item.name} fill className="object-contain" sizes="(max-width: 768px) 100vw, 768px" />
                  {soldOut && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-2xl font-bold text-gray-700">已搶購一空</span>}
                  {q > 0 && <span className="absolute left-3 top-3 rounded-full bg-green-700 px-3 py-1 text-sm font-bold text-white shadow">✓ 已選 {q} 件</span>}
                </div>
              )}
              <div className="p-5">
                <h2 className="text-[21px] font-bold leading-snug text-gray-900">{item.name}</h2>
                {item.spec && <p className="mt-1.5 inline-block rounded-lg bg-gray-100 px-2.5 py-1 text-[14px] text-gray-700">規格：{item.spec}</p>}

                {/* 價格 */}
                <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <div>
                    <span className="block text-[13px] font-bold text-red-600">團購價</span>
                    <span className="text-[32px] font-extrabold leading-none text-red-600 tabular-nums">{money(item.price)}</span>
                  </div>
                  {save > 0 && (
                    <div className="pb-0.5">
                      <span className="block text-[14px] text-gray-400 line-through">原價 {money(item.original_price!)}</span>
                      <span className="inline-block rounded-md bg-red-50 px-1.5 py-0.5 text-[13px] font-bold text-red-600">現省 {money(save)}</span>
                    </div>
                  )}
                </div>

                {/* 限量、限購 */}
                {(item.total_quota != null || item.per_person_limit != null) && (
                  <div className="mt-3 space-y-2">
                    {item.total_quota != null && (
                      <div>
                        <div className="flex justify-between text-[13px] font-bold">
                          <span className="text-gray-600">限量 {item.total_quota} 件</span>
                          <span className={soldOut ? 'text-gray-500' : 'text-red-600'}>{soldOut ? '已售完' : `剩 ${item.remaining} 件`}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(3, Math.min(100, (item.sold / item.total_quota) * 100))}%` }} />
                        </div>
                      </div>
                    )}
                    {item.per_person_limit != null && <p className="text-[13px] font-semibold text-gray-500">每人限購 {item.per_person_limit} 件</p>}
                  </div>
                )}

                {/* 跟團按鈕／數量 */}
                <div className="mt-4">
                  {now === null ? (
                    <div className="h-[56px] rounded-2xl bg-gray-100" aria-hidden />
                  ) : isOpen && !soldOut ? (
                    q === 0 ? (
                      <button onClick={() => setItemQty(item, 1)}
                        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-green-700 text-[18px] font-bold text-white shadow-sm active:scale-[0.99] active:bg-green-800">
                        <span className="text-2xl leading-none" aria-hidden>＋</span>我要跟團
                      </button>
                    ) : (
                      <div className="rounded-2xl bg-green-50 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center overflow-hidden rounded-xl border-2 border-green-700 bg-white">
                            <button aria-label={q === 1 ? '移除' : '減少'} onClick={() => setItemQty(item, q - 1)}
                              className="flex h-12 w-12 items-center justify-center text-2xl font-bold text-green-800 active:bg-green-100">−</button>
                            <span className="w-12 text-center text-[22px] font-extrabold tabular-nums text-gray-900" aria-live="polite">{q}</span>
                            <button aria-label="增加" onClick={() => setItemQty(item, q + 1)} disabled={q >= cap}
                              className="flex h-12 w-12 items-center justify-center text-2xl font-bold text-green-800 active:bg-green-100 disabled:text-gray-300">+</button>
                          </div>
                          <div className="min-w-0 flex-1 text-right">
                            <p className="text-[13px] text-gray-600">小計</p>
                            <p className="text-[20px] font-bold text-gray-900 tabular-nums">{money(item.price * q)}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-[13px] text-green-800">
                          {q >= cap && item.per_person_limit != null && cap === item.per_person_limit ? `已達每人限購 ${cap} 件` : '✓ 已加入，選好後按下方「下一步」'}
                        </p>
                      </div>
                    )
                  ) : (
                    <p className="w-full rounded-2xl bg-gray-100 py-4 text-center text-[16px] font-bold text-gray-500">
                      {soldOut ? '已售完' : phase === 'upcoming' ? `${formatTwDateTime(campaign.starts_at)} 開團` : '本檔已截單'}
                    </p>
                  )}
                </div>

                {item.description && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <h3 className="mb-2 text-[16px] font-bold text-gray-900">商品介紹</h3>
                    <Collapsible collapsedHeight={190} moreLabel="看完整商品介紹 ▼">
                      <GroupBuyText text={item.description} size="md" />
                    </Collapsible>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </section>

      {campaign.description && (
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-center text-[20px] font-bold text-gray-900">團購說明</h2>
          <Collapsible collapsedHeight={520} moreLabel="展開完整說明 ▼">
            <GroupBuyText text={campaign.description} />
          </Collapsible>
        </section>
      )}

      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-center text-[20px] font-bold text-gray-900">常見問題</h2>
        <div className="divide-y divide-gray-100">
          {[
            ['什麼時候出貨？', `${formatTwDateTime(campaign.ends_at)} 截單後統一向品牌叫貨，到貨後依序出貨。${campaign.ship_note}`],
            ['怎麼付款？', `${payText}，不需要先轉帳。`],
            ...(hasFrozen ? [['冷凍商品要注意什麼？', '收到通知請盡快取貨或在家收件，取回後立即冷凍保存。']] : []),
            ['想取消或修改訂單？', '截單前請直接傳 LINE 給我們，截單後已向品牌叫貨，恕無法取消。'],
          ].map(([qText, a]) => (
            <div key={qText} className="py-3.5">
              <p className="flex gap-2 text-[16px] font-bold text-gray-900"><span className="text-green-700">Q</span>{qText}</p>
              <p className="mt-1 flex gap-2 text-[15px] leading-[1.8] text-gray-600"><span className="font-bold text-gray-400">A</span><span>{a}</span></p>
            </div>
          ))}
        </div>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-[#06C755] font-bold text-[#06A447]">
          有問題？加 LINE 問我們
        </a>
      </section>

      {/* 底部固定列的墊片 */}
      <div className="h-24" aria-hidden />

      {/* ── 底部固定列 ───────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 bottom-skirt border-t border-gray-200 bg-white px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-gray-600">{count > 0 ? `已選 ${count} 件` : '還沒選商品'}</p>
              <p className="text-[22px] font-bold leading-tight text-red-600 tabular-nums">{money(subtotal)}</p>
              {freeHint && <p className="text-[12px] font-bold text-green-700">{freeHint}</p>}
            </div>
            <button disabled={count === 0} onClick={() => setCheckingOut(true)}
              className="min-h-[56px] flex-[1.5] rounded-2xl bg-green-700 px-3 text-[17px] font-bold text-white shadow-sm active:bg-green-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none">
              {count === 0 ? '請先選擇商品' : '下一步：填收件資料 →'}
            </button>
          </div>
        </div>
      )}

      {checkingOut && isOpen && (
        <CheckoutSheet
          campaign={campaign} lines={lines} subtotal={subtotal} methods={methods}
          onClose={() => setCheckingOut(false)}
          onPlaced={(p) => { setQty({}); setCheckingOut(false); setPlaced(p) }}
        />
      )}
    </div>
  )
}

// ── 結帳 ─────────────────────────────────────────────────

const CUSTOMER_KEY = 'gb-customer'

/** 下單成功後顯示用：金額以伺服器回傳為準，商品明細與收件資料是送出當下的內容 */
type Placed = {
  order_no: string; subtotal: number; shipping_fee: number; total_amount: number; method: ShippingMethod
  lines: { item_id: number; name: string; spec: string; image_url: string | null; price: number; quantity: number }[]
  customer: { name: string; phone: string; store: Store | null; address: string; deliveryTime: string; note: string }
}

function CheckoutSheet({ campaign, lines, subtotal, methods, onClose, onPlaced }: {
  campaign: PublicCampaign['campaign']
  lines: { item: PublicItem; quantity: number }[]
  subtotal: number
  methods: ShippingMethod[]
  onClose: () => void
  onPlaced: (p: Placed) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<ShippingMethod>(methods[0])
  const [store, setStore] = useState<Store | null>(null)
  const [address, setAddress] = useState('')
  const [deliveryTime, setDeliveryTime] = useState<string>('不指定')
  const [note, setNote] = useState('')
  const [picking, setPicking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 記住上次填的收件資料，每月跟團不用重打
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null')
      if (c) { setName(c.name || ''); setPhone(c.phone || ''); setAddress(c.address || ''); if (c.store) setStore(c.store) }
    } catch {}
  }, [])

  const fee = shippingFee(campaign, method, subtotal)
  const input = useMemo(() => ({
    customer_name: name, phone: phone.replace(/[\s-]/g, ''), shipping_method: method,
    store_id: isStorePickup(method) ? store?.id ?? null : null,
    home_address: address, delivery_time: deliveryTime, note,
    items: lines.map(l => ({ item_id: l.item.id, quantity: l.quantity })),
  }), [name, phone, method, store, address, deliveryTime, note, lines])

  const submit = async () => {
    const problem = checkoutProblem(input, methods)
    if (problem) { setError(problem); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/group-buy/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: campaign.slug, ...input }),
      })
      const d = await res.json()
      if (!d.success) { setError(d.error || '下單失敗'); return }
      try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, address, store })) } catch {}
      onPlaced({
        order_no: d.data.order_no, subtotal: d.data.subtotal, shipping_fee: d.data.shipping_fee, total_amount: d.data.total_amount, method,
        lines: lines.map(l => ({ item_id: l.item.id, name: l.item.name, spec: l.item.spec, image_url: l.item.image_url, price: l.item.price, quantity: l.quantity })),
        customer: { name: name.trim(), phone: input.phone, store: isStorePickup(method) ? store : null, address: address.trim(), deliveryTime, note: note.trim() },
      })
    } catch {
      setError('網路不穩，請再按一次')
    } finally {
      setSubmitting(false)
    }
  }

  const field = 'mt-1.5 w-full rounded-xl border-2 border-gray-200 px-3 py-3 text-base focus:border-green-600 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="填寫收件資料">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">填寫收件資料</h2>
          <button onClick={onClose} className="h-10 w-10 rounded-full text-2xl text-gray-500" aria-label="關閉">×</button>
        </div>

        <label className="mt-4 block font-bold text-gray-800">收件人姓名
          <input className={field} value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={20} />
        </label>
        <label className="mt-4 block font-bold text-gray-800">手機
          <input className={field} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" />
        </label>

        <fieldset className="mt-5">
          <legend className="font-bold text-gray-800">取貨方式</legend>
          <div className="mt-2 space-y-2">
            {methods.map(m => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${method === m ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
                <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="h-5 w-5 accent-green-700" />
                <span className="flex-1">
                  <span className="block font-bold text-gray-900">{SHIPPING_LABEL[m]}</span>
                  <span className="text-[13px] text-gray-600">運費 {money(shippingFee(campaign, m, subtotal))}{isStorePickup(m) ? '・取貨時付款' : '・送達時付款'}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {isStorePickup(method) ? (
          <div className="mt-4">
            <p className="font-bold text-gray-800">取貨門市</p>
            <button onClick={() => setPicking(true)}
              className="mt-1.5 w-full rounded-xl border-2 border-dashed border-green-600 px-3 py-3 text-left">
              {store ? <><b className="text-gray-900">{store.store_name}門市</b><span className="block text-[13px] text-gray-600">{store.address}</span></>
                : <span className="font-bold text-green-700">＋ 選擇 7-11 門市</span>}
            </button>
          </div>
        ) : (
          <>
            <label className="mt-4 block font-bold text-gray-800">收件地址
              <textarea className={field} rows={2} value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address"
                placeholder="例：台北市大安區建國南路一段 28 號 3 樓" />
            </label>
            <label className="mt-4 block font-bold text-gray-800">希望送達時段
              <select className={field} value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)}>
                {DELIVERY_TIMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
          </>
        )}

        <label className="mt-4 block font-bold text-gray-800">備註（選填）
          <input className={field} value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
        </label>

        <div className="mt-5 rounded-2xl bg-canvas p-4 text-[15px]">
          {lines.map(l => (
            <div key={l.item.id} className="flex justify-between gap-3">
              <span className="min-w-0 text-gray-700">{l.item.name}{l.item.spec && `（${l.item.spec}）`} × {l.quantity}</span>
              <span className="flex-shrink-0 tabular-nums">{money(l.item.price * l.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-gray-600"><span>運費</span><span className="tabular-nums">{money(fee)}</span></div>
          <div className="mt-1 flex justify-between text-lg font-bold"><span>{isStorePickup(method) ? '取貨時付款' : '送達時付款'}</span><span className="text-red-600 tabular-nums">{money(subtotal + fee)}</span></div>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-700">{error}</p>}

        <button onClick={submit} disabled={submitting}
          className="mt-4 min-h-[52px] w-full rounded-2xl bg-green-700 text-lg font-bold text-white disabled:opacity-50">
          {submitting ? '送出中…' : `確認跟團（${money(subtotal + fee)}）`}
        </button>
        <p className="mt-2 text-center text-[13px] text-gray-500">截單後統一出貨；截單前如需取消請傳 LINE</p>
      </div>
      {picking && <StorePickerModal title={`選擇 7-11 取貨門市（${method === '711_normal' ? '常溫' : '冷凍'}）`} onSelect={s => { setStore(s); setPicking(false) }} onClose={() => setPicking(false)} />}
    </div>
  )
}

function OrderPlaced({ placed, campaign }: { placed: Placed; campaign: PublicCampaign['campaign'] }) {
  // 成功頁比團購頁短很多：要等它畫出來後再「直接跳」到最上面。
  // 全站開了平滑捲動，若在換頁前慢慢捲，頁面一變短 iPhone 就會中斷捲動，
  // 客人停在頁尾，以為沒有下單成功。
  useEffect(() => {
    const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    toTop()
    const raf = requestAnimationFrame(toTop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pickup = isStorePickup(placed.method)
  const payLabel = pickup ? '取貨時付款' : '送達時付款'
  const count = placed.lines.reduce((n, l) => n + l.quantity, 0)
  const c = placed.customer
  const copyNo = async () => {
    try { await navigator.clipboard.writeText(placed.order_no); toast.success('已複製訂單編號') } catch { toast.error('複製失敗，請截圖保存') }
  }
  const steps = [
    `${formatTwDateTime(campaign.ends_at)} 截單`,
    '截單後統一出貨',
    pickup ? '貨到門市時，7-11 會傳簡訊通知' : '黑貓配送到府',
    `${pickup ? '到店取貨時' : '收貨時'}付款 ${money(placed.total_amount)}`,
  ]
  const card = 'mt-4 rounded-3xl bg-white p-5 text-left shadow-sm'
  const h2 = 'flex items-center gap-2 text-lg font-bold text-gray-900'

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-16">
      {/* ── 成功 + 訂單編號 + 應付金額：第一屏一定看得到 ── */}
      <section className="rounded-3xl bg-gradient-to-br from-green-700 to-emerald-600 px-5 pb-5 pt-6 text-center text-white shadow-md">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-green-700" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <h1 className="mt-3 text-[26px] font-extrabold">跟團成功！</h1>
        <p className="mt-1 text-[15px] text-green-50">訂單已成立，現在不用付款</p>
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-left text-gray-900">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-gray-500">訂單編號</p>
              <p className="font-mono text-[22px] font-bold tracking-wide">{placed.order_no}</p>
            </div>
            <button onClick={copyNo} className="flex-shrink-0 rounded-full border border-green-600 px-3 py-1.5 text-sm font-bold text-green-700 active:bg-green-50">複製</button>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-gray-200 pt-2">
            <span className="text-[15px] font-bold text-gray-700">{payLabel}</span>
            <span className="text-[26px] font-extrabold text-red-600 tabular-nums">{money(placed.total_amount)}</span>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-green-50">📸 請截圖保存這個畫面</p>
      </section>

      {/* ── 跟團商品 ── */}
      <section className={card} aria-label="跟團商品">
        <h2 className={h2}>🛍️ 跟團商品 <span className="text-sm font-normal text-gray-500">共 {count} 件</span></h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {placed.lines.map(l => (
            <li key={l.item_id} className="flex gap-3 py-3 first:pt-0">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-white">
                {l.image_url
                  ? <Image src={l.image_url} alt="" fill className="object-contain" sizes="64px" />
                  : <span className="flex h-full items-center justify-center text-2xl" aria-hidden>📦</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-snug text-gray-900">{l.name}</p>
                {l.spec && <p className="text-[14px] text-gray-600">{l.spec}</p>}
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-[14px] text-gray-600 tabular-nums">{money(l.price)} × <b className="text-base text-gray-900">{l.quantity}</b></span>
                  <span className="font-bold text-gray-900 tabular-nums">{money(l.price * l.quantity)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-1 space-y-1 rounded-2xl bg-canvas p-3 text-[15px]">
          <div className="flex justify-between text-gray-600"><dt>商品小計</dt><dd className="tabular-nums">{money(placed.subtotal)}</dd></div>
          <div className="flex justify-between text-gray-600"><dt>運費（{SHIPPING_SHORT[placed.method]}）</dt><dd className="tabular-nums">{placed.shipping_fee ? money(placed.shipping_fee) : '免運'}</dd></div>
          <div className="flex justify-between border-t border-line pt-1.5 text-lg font-bold"><dt>{payLabel}</dt><dd className="text-red-600 tabular-nums">{money(placed.total_amount)}</dd></div>
        </dl>
      </section>

      {/* ── 收件資訊 ── */}
      <section className={card} aria-label="收件資訊">
        <h2 className={h2}>{pickup ? '🏪' : '🚚'} 收件資訊</h2>
        <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-2 text-[15px]">
          <dt className="text-gray-500">收件人</dt><dd className="font-bold text-gray-900">{c.name}</dd>
          <dt className="text-gray-500">手機</dt><dd className="font-mono text-gray-900">{c.phone}</dd>
          <dt className="text-gray-500">取貨方式</dt><dd className="text-gray-900">{SHIPPING_LABEL[placed.method]}</dd>
          {pickup && c.store ? <>
            <dt className="text-gray-500">取貨門市</dt>
            <dd><b className="text-gray-900">{c.store.store_name}門市</b><span className="block text-[14px] text-gray-600">{c.store.address}</span></dd>
          </> : <>
            <dt className="text-gray-500">地址</dt><dd className="text-gray-900">{c.address}</dd>
            <dt className="text-gray-500">送達時段</dt><dd className="text-gray-900">{c.deliveryTime}</dd>
          </>}
          {c.note && <><dt className="text-gray-500">備註</dt><dd className="text-gray-900">{c.note}</dd></>}
        </dl>
      </section>

      {/* ── 接下來 ── */}
      <section className={card} aria-label="接下來">
        <h2 className={h2}>📅 接下來</h2>
        <ol className="mt-3 space-y-3">
          {steps.map((t, i) => (
            <li key={i} className="flex items-start gap-3 text-[15px] text-gray-800">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[13px] text-gray-500">截單前如需修改或取消，請傳 LINE 並告訴我們訂單編號。</p>
      </section>

      <a href={LINE_URL} target="_blank" rel="noopener noreferrer"
        className="mt-5 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#06C755] text-lg font-bold text-white">加 LINE 收出貨通知</a>
      <div className="mt-4 text-center">
        <Link href="/" className="inline-block font-bold text-green-700">← 回首頁逛逛</Link>
      </div>
    </div>
  )
}
