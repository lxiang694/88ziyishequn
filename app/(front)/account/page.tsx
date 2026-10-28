'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUserAuth, useRequireUser } from '@/components/front/UserAuthContext'
import OrderProgress from '@/components/front/account/OrderProgress'
import { useMemberOrders } from '@/components/front/account/useMemberOrders'
import { isActiveOrder, isReadyForPickup, orderStage, type MemberOrder } from '@/lib/memberOrders'
import { formatPrice } from '@/lib/utils'

const LINE_URL = 'https://line.me/ti/p/yJdrshwviU'
const maskPhone = (p?: string | null) => (p && /^09\d{8}$/.test(p) ? `${p.slice(0, 4)}-***-${p.slice(7)}` : '')
const shortDate = (iso: string) => { const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString(); return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` }

/**
 * 會員中心首頁。
 * 依客人最常來做的事排順序：包裹到了沒 → 進行中的訂單到哪了 → 再買一次常買的 →
 * 寫評價 → 其他設定。以前最上面是「總訂單數／累計消費」，對客人沒有用。
 */
export default function AccountDashboard() {
  const router = useRouter()
  const { user, loading } = useRequireUser()
  const { authedFetch, signOut } = useUserAuth()
  const { orders, rebuy, reviewable, loading: loadingOrders, reload, addToCart } = useMemberOrders(!!user)
  const [profile, setProfile] = useState<any>(null)
  const [linking, setLinking] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    authedFetch('/api/account/profile').then(r => r.json()).then(p => { if (p.success) setProfile(p.data) }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const linkOldOrders = async () => {
    setLinking(true)
    const d = await (await authedFetch('/api/account/link-orders', { method: 'POST' })).json()
    setLinkMessage(d.success ? (d.linked > 0 ? `成功找回 ${d.linked} 筆舊訂單` : '沒有找到可找回的舊訂單') : (d.error || '找回失敗'))
    if (d.success) reload()
    setLinking(false)
  }
  const logout = async () => { await signOut(); router.push('/') }

  if (loading || loadingOrders) return <div className="py-20 text-center text-gray-600">載入中...</div>
  if (!user) return null

  const displayName: string = profile?.name || (user.user_metadata?.name as string) || user.email?.split("@")[0] || "會員"
  const pickup = orders.filter(o => isReadyForPickup(o))
  const active = orders.filter(o => isActiveOrder(o) && !isReadyForPickup(o))

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-6 pt-16 sm:py-10">

        {/* ── 招呼 ── */}
        <section className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-800" aria-hidden>
            {Array.from(displayName)[0]}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-gray-900">{displayName}，您好</h1>
            <p className="mt-0.5 text-[14px] text-gray-500">{maskPhone(profile?.phone) || '還沒填手機'}{profile?.default_store_name && <>・常用 7-11 {profile.default_store_name}</>}</p>
          </div>
          <Link href="/account/profile" className="flex-shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">編輯</Link>
        </section>

        {/* ── 包裹到店了 ── */}
        {pickup.map(o => (
          <Link key={o.order_no} href="/account/orders" className="block rounded-3xl border-2 border-green-500 bg-green-50 p-5">
            <p className="flex items-center gap-2 text-lg font-bold text-green-900">📦 包裹到店了，可以取貨囉！</p>
            <p className="mt-1 text-[15px] leading-relaxed text-green-900">
              7-11 <b>{o.store_name}</b>門市・{formatPrice(o.total)}（取貨時付款）<br />
              <span className="text-[14px] text-green-800">到櫃台報取件人姓名或手機號碼即可取貨</span>
            </p>
          </Link>
        ))}

        {/* ── 進行中的訂單 ── */}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">進行中的訂單{active.length > 0 && <span className="ml-1.5 text-base text-gray-500">({active.length})</span>}</h2>
            <Link href="/account/orders" className="text-sm font-bold text-green-700">全部訂單 →</Link>
          </div>
          {active.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center">
              <p className="text-gray-600">目前沒有進行中的訂單</p>
              {orders.length === 0 && <Link href="/shop" className="mt-3 inline-block rounded-xl bg-green-700 px-5 py-2.5 font-bold text-white">去逛逛</Link>}
            </div>
          ) : (
            <ul className="space-y-4">
              {active.slice(0, 3).map(o => <ActiveOrder key={o.order_no} order={o} />)}
            </ul>
          )}
        </section>

        {/* ── 找回舊訂單 ── */}
        {profile?.phone && orders.length === 0 && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">🔗 以前下過單嗎？</p>
            <p className="mt-1 text-[14px] leading-relaxed text-amber-800">註冊前用同一支手機下的訂單，可以一鍵找回到會員帳號。</p>
            <button onClick={linkOldOrders} disabled={linking}
              className="mt-3 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
              {linking ? '查找中...' : '找回舊訂單'}
            </button>
            {linkMessage && <p className="mt-2 text-[13px] text-amber-900">{linkMessage}</p>}
          </section>
        )}

        {/* ── 再買一次 ── */}
        {rebuy.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-gray-900">再買一次</h2>
            <p className="mb-3 text-[13px] text-gray-500">您常買的商品，一鍵加入購物車（以目前價格計算）</p>
            <ul className="divide-y divide-gray-100">
              {rebuy.map(r => (
                <li key={r.variant_id} className="flex items-center gap-3 py-3">
                  <Link href={`/products/${r.slug}`} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {r.cover_image_url ? <Image src={r.cover_image_url} alt={r.product_name} fill className="object-cover" sizes="64px" /> : <span className="flex h-full items-center justify-center text-2xl">💊</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${r.slug}`} className="line-clamp-1 font-bold text-gray-900">{r.product_name}</Link>
                    <p className="text-[13px] text-gray-500">{r.variant_name}・買過 {r.times} 次</p>
                    <p className="font-bold text-green-700">{formatPrice(r.sale_price)}</p>
                  </div>
                  <button onClick={() => addToCart(r)} disabled={r.stock_qty <= 0}
                    className="flex-shrink-0 rounded-xl bg-green-700 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-500">
                    {r.stock_qty > 0 ? '加入購物車' : '暫時缺貨'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 寫評價 ── */}
        {reviewable.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-gray-900">分享使用心得</h2>
            <p className="mb-3 text-[13px] text-gray-500">您買過這些商品，寫下感受可以幫助其他人選擇</p>
            <ul className="space-y-2">
              {reviewable.slice(0, 3).map(r => (
                <li key={r.product_id}>
                  <Link href={`/products/${r.slug}#write-review`} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-2.5 hover:border-green-300">
                    <span className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {r.cover_image_url ? <Image src={r.cover_image_url} alt="" fill className="object-cover" sizes="48px" /> : <span className="flex h-full items-center justify-center">💊</span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">{r.product_name}</span>
                    <span className="flex-shrink-0 text-sm font-bold text-amber-600">★ 寫評價</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 會員服務 ── */}
        <nav aria-label="會員服務" className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {[
            { href: '/account/orders', icon: '📦', label: '我的訂單', hint: `共 ${orders.length} 筆，含團購` },
            { href: '/account/addresses', icon: '📍', label: '收件人與取貨門市', hint: '結帳時一鍵帶入' },
            { href: '/account/profile', icon: '👤', label: '個人資料', hint: '姓名、手機、LINE ID' },
          ].map(m => (
            <Link key={m.href} href={m.href} className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 hover:bg-gray-50">
              <span className="text-2xl" aria-hidden>{m.icon}</span>
              <span className="min-w-0 flex-1"><span className="block font-bold text-gray-900">{m.label}</span><span className="text-[13px] text-gray-500">{m.hint}</span></span>
              <span className="text-gray-300" aria-hidden>›</span>
            </Link>
          ))}
          <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 hover:bg-gray-50">
            <span className="text-2xl" aria-hidden>💬</span>
            <span className="min-w-0 flex-1"><span className="block font-bold text-gray-900">LINE 客服</span><span className="text-[13px] text-gray-500">訂單、商品問題都可以問</span></span>
            <span className="text-gray-300" aria-hidden>›</span>
          </a>
          <button onClick={logout} className="w-full px-5 py-4 text-left text-[15px] font-semibold text-gray-500 hover:bg-gray-50">登出</button>
        </nav>
      </div>
    </div>
  )
}

function ActiveOrder({ order: o }: { order: MemberOrder }) {
  const names = o.items.map(i => i.name)
  return (
    <li className="rounded-2xl border border-gray-100 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] text-gray-500">
            {o.kind === 'group_buy' && <span className="flex-shrink-0 whitespace-nowrap rounded bg-sky-100 px-1.5 py-0.5 text-[12px] font-bold text-sky-800">團購</span>}
            {shortDate(o.created_at)} 下單・{o.order_no}
          </p>
          <p className="mt-1 line-clamp-1 font-bold text-gray-900">{names.slice(0, 2).join('、')}{names.length > 2 && ` 等 ${names.length} 樣`}</p>
        </div>
        <p className="flex-shrink-0 font-bold text-green-700">{formatPrice(o.total)}</p>
      </div>
      <OrderProgress stage={orderStage(o)} />
    </li>
  )
}
