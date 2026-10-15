'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import StorePickerModal, { type Store } from '@/components/front/StorePickerModal'
import {
  campaignPhase, checkoutProblem, enabledMethods, formatTwDateTime, shippingFee,
  DELIVERY_TIMES, SHIPPING_LABEL, type ShippingMethod,
} from '@/lib/groupBuy/domain'
import type { PublicCampaign, PublicItem } from '@/lib/groupBuy/repo'

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
  const [placed, setPlaced] = useState<null | { order_no: string; total_amount: number; shipping_fee: number; method: ShippingMethod }>(null)

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
          <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold ${
            phase === 'open' ? 'bg-red-50 text-red-600' : phase === 'upcoming' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            {phase === 'open' ? '🔥 開團中' : phase === 'upcoming' ? '⏰ 即將開團' : '本檔已截單'}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">{campaign.title}</h1>
          {campaign.subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">{campaign.subtitle}</p>}

          <div className={`mt-4 rounded-2xl px-4 py-3 ${phase === 'open' ? 'bg-red-600 text-white' : 'bg-sage text-gray-800'}`}>
            {phase === 'open' && <p className="text-sm font-semibold opacity-90">距離截單</p>}
            {phase === 'upcoming' && <p className="text-sm font-semibold">距離開團</p>}
            <p className="text-2xl font-bold tabular-nums">
              {now === null ? '—' : phase === 'open' ? countdown(new Date(campaign.ends_at).getTime() - now.getTime())
                : phase === 'upcoming' ? countdown(new Date(campaign.starts_at).getTime() - now.getTime()) : '已截單，感謝跟團'}
            </p>
            <p className={`mt-0.5 text-[13px] ${phase === 'open' ? 'opacity-90' : 'text-gray-600'}`}>
              開團 {formatTwDateTime(campaign.starts_at)} ～ 截單 {formatTwDateTime(campaign.ends_at)}
            </p>
          </div>

          <ul className="mt-4 space-y-1.5 text-[15px] text-gray-700">
            {campaign.ship_note && <li>📦 {campaign.ship_note}</li>}
            {methods.map(m => (
              <li key={m}>🧊 {SHIPPING_LABEL[m]}，運費 {money(m === '711' ? campaign.fee_711 : campaign.fee_home)}</li>
            ))}
            {campaign.free_shipping_threshold != null && <li>🎁 滿 {money(campaign.free_shipping_threshold)} 免運</li>}
            {buyers >= 3 && <li className="font-bold text-red-600">👥 已有 {buyers} 人跟團</li>}
          </ul>
        </div>
      </section>

      {/* ── 商品 ───────────────────────────────────── */}
      <section className="mt-5 space-y-4" aria-label="團購商品">
        {items.map(item => {
          const soldOut = item.remaining === 0
          const q = qty[item.id] || 0
          return (
            <article key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              {item.image_url && (
                <div className="relative aspect-square bg-white">
                  <Image src={item.image_url} alt={item.name} fill className="object-contain" sizes="(max-width: 768px) 100vw, 768px" />
                  {soldOut && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-2xl font-bold text-gray-700">已搶購一空</span>}
                </div>
              )}
              <div className="p-5">
                <h2 className="text-xl font-bold leading-snug text-gray-900">{item.name}</h2>
                {item.spec && <p className="mt-0.5 text-[15px] text-gray-600">{item.spec}</p>}
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-bold text-red-600">團購價</span>
                  <span className="text-3xl font-bold text-red-600">{money(item.price)}</span>
                  {item.original_price != null && item.original_price > item.price && (
                    <span className="text-gray-500 line-through">原價 {money(item.original_price)}</span>
                  )}
                </div>

                {item.total_quota != null && (
                  <div className="mt-3">
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(100, (item.sold / item.total_quota) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-gray-600">
                      限量 {item.total_quota}，{soldOut ? '已售完' : `剩 ${item.remaining} 件`}
                    </p>
                  </div>
                )}
                {item.per_person_limit != null && <p className="mt-1 text-[13px] text-gray-500">每人限購 {item.per_person_limit} 件</p>}

                {item.description && (
                  <details className="mt-3 rounded-xl bg-canvas px-3 py-2">
                    <summary className="cursor-pointer text-[15px] font-bold text-green-800">商品介紹</summary>
                    <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{item.description}</p>
                  </details>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  {isOpen && !soldOut ? (
                    q === 0 ? (
                      <button onClick={() => setItemQty(item, 1)}
                        className="min-h-[48px] w-full rounded-2xl bg-green-700 text-base font-bold text-white active:bg-green-800">
                        + 我要跟團
                      </button>
                    ) : (
                      <div className="flex w-full items-center justify-between rounded-2xl border-2 border-green-700 px-2">
                        <button aria-label="減少" onClick={() => setItemQty(item, q - 1)} className="h-12 w-12 text-2xl font-bold text-green-800">−</button>
                        <span className="text-lg font-bold">已選 {q} 件</span>
                        <button aria-label="增加" onClick={() => setItemQty(item, q + 1)} className="h-12 w-12 text-2xl font-bold text-green-800">+</button>
                      </div>
                    )
                  ) : (
                    <p className="w-full rounded-2xl bg-gray-100 py-3 text-center font-bold text-gray-500">
                      {soldOut ? '已售完' : phase === 'upcoming' ? `${formatTwDateTime(campaign.starts_at)} 開團` : '本檔已截單'}
                    </p>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {campaign.description && (
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">團購說明</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{campaign.description}</p>
        </section>
      )}

      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">常見問題</h2>
        <dl className="mt-3 space-y-3 text-[15px] leading-relaxed">
          <div><dt className="font-bold text-gray-800">什麼時候出貨？</dt>
            <dd className="text-gray-600">{formatTwDateTime(campaign.ends_at)} 截單後統一向品牌叫貨，到貨後依序出貨。{campaign.ship_note}</dd></div>
          <div><dt className="font-bold text-gray-800">怎麼付款？</dt>
            <dd className="text-gray-600">{methods.includes('711') && '7-11 取貨時付款'}{methods.length > 1 && '；'}{methods.includes('home') && '黑貓宅配到府時付款（貨到付款）'}。不需要先轉帳。</dd></div>
          <div><dt className="font-bold text-gray-800">冷凍商品要注意什麼？</dt>
            <dd className="text-gray-600">收到通知請盡快取貨或在家收件，取回後立即冷凍保存。</dd></div>
          <div><dt className="font-bold text-gray-800">想取消或修改訂單？</dt>
            <dd className="text-gray-600">截單前請直接傳 LINE 給我們，截單後已向品牌叫貨，恕無法取消。</dd></div>
        </dl>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer"
          className="mt-4 flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-[#06C755] font-bold text-[#06A447]">
          有問題？加 LINE 問我們
        </a>
      </section>

      {/* 底部固定列的墊片 */}
      <div className="h-20" aria-hidden />

      {/* ── 底部固定列 ───────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-gray-600">{count > 0 ? `已選 ${count} 件` : '還沒選商品'}</p>
              <p className="text-xl font-bold text-red-600">{money(subtotal)}</p>
            </div>
            <button disabled={count === 0} onClick={() => setCheckingOut(true)}
              className="min-h-[52px] flex-[1.4] rounded-2xl bg-green-700 text-base font-bold text-white disabled:opacity-40">
              填寫收件資料 →
            </button>
          </div>
        </div>
      )}

      {checkingOut && isOpen && (
        <CheckoutSheet
          campaign={campaign} lines={lines} subtotal={subtotal} methods={methods}
          onClose={() => setCheckingOut(false)}
          onPlaced={(p) => { setQty({}); setCheckingOut(false); setPlaced(p); window.scrollTo({ top: 0 }) }}
        />
      )}
    </div>
  )
}

// ── 結帳 ─────────────────────────────────────────────────

const CUSTOMER_KEY = 'gb-customer'

function CheckoutSheet({ campaign, lines, subtotal, methods, onClose, onPlaced }: {
  campaign: PublicCampaign['campaign']
  lines: { item: PublicItem; quantity: number }[]
  subtotal: number
  methods: ShippingMethod[]
  onClose: () => void
  onPlaced: (p: { order_no: string; total_amount: number; shipping_fee: number; method: ShippingMethod }) => void
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
    store_id: method === '711' ? store?.id ?? null : null,
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
      onPlaced({ ...d.data, method })
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
                  <span className="text-[13px] text-gray-600">運費 {money(shippingFee(campaign, m, subtotal))}{m === '711' ? '・取貨時付款' : '・送達時付款'}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === '711' ? (
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
          <div className="mt-1 flex justify-between text-lg font-bold"><span>{method === '711' ? '取貨時付款' : '送達時付款'}</span><span className="text-red-600 tabular-nums">{money(subtotal + fee)}</span></div>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 font-semibold text-red-700">{error}</p>}

        <button onClick={submit} disabled={submitting}
          className="mt-4 min-h-[52px] w-full rounded-2xl bg-green-700 text-lg font-bold text-white disabled:opacity-50">
          {submitting ? '送出中…' : `確認跟團（${money(subtotal + fee)}）`}
        </button>
        <p className="mt-2 text-center text-[13px] text-gray-500">截單後統一出貨；截單前如需取消請傳 LINE</p>
      </div>
      {picking && <StorePickerModal title="選擇 7-11 取貨門市（冷凍）" onSelect={s => { setStore(s); setPicking(false) }} onClose={() => setPicking(false)} />}
    </div>
  )
}

function OrderPlaced({ placed, campaign }: {
  placed: { order_no: string; total_amount: number; shipping_fee: number; method: ShippingMethod }
  campaign: PublicCampaign['campaign']
}) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-16 text-center">
      <p className="text-6xl" aria-hidden>🎉</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">跟團成功！</h1>
      <div className="mt-5 rounded-3xl bg-white p-5 text-left shadow-sm">
        <p className="text-[15px] text-gray-600">訂單編號</p>
        <p className="font-mono text-2xl font-bold tracking-wide text-gray-900">{placed.order_no}</p>
        <p className="mt-3 text-[15px] text-gray-600">{placed.method === '711' ? '取貨時付款' : '送達時付款'}</p>
        <p className="text-2xl font-bold text-red-600">{money(placed.total_amount)}</p>
        <p className="mt-4 rounded-xl bg-canvas p-3 text-[15px] leading-relaxed text-gray-700">
          {formatTwDateTime(campaign.ends_at)} 截單後統一出貨，{placed.method === '711' ? '到店時會收到 7-11 簡訊通知' : '黑貓會在出貨後配送'}。
          請截圖保存這個畫面，有問題傳 LINE 給我們。
        </p>
      </div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer"
        className="mt-5 flex min-h-[48px] items-center justify-center rounded-2xl bg-[#06C755] font-bold text-white">加 LINE 收出貨通知</a>
      <Link href="/" className="mt-4 inline-block font-bold text-green-700">← 回首頁逛逛</Link>
    </div>
  )
}
