import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { packageEta, type ShipKind, type ShipPackage } from '@/lib/shipPackages'

export interface PackageLine { key: string | number; name: string; variant?: string; quantity: number; subtotal: number; image?: string | null }

const TONE: Record<string, { head: string; text: string; badge: string; pay: string; dot: string }> = {
  現貨: { head: 'bg-green-50', text: 'text-green-900', badge: 'bg-green-700', pay: 'bg-green-50 text-green-800', dot: 'bg-green-700' },
  預購: { head: 'bg-sky-50', text: 'text-sky-900', badge: 'bg-sky-600', pay: 'bg-sky-50 text-sky-800', dot: 'bg-sky-600' },
  none: { head: 'bg-gray-50', text: 'text-gray-900', badge: 'bg-gray-600', pay: 'bg-gray-100 text-gray-800', dot: 'bg-gray-600' },
}
const tone = (k: ShipKind | null) => TONE[k || 'none']
const mixed = (packages: ShipPackage<PackageLine>[]) => packages.some(p => p.kind === '現貨') && packages.some(p => p.kind === '預購')

/**
 * 結帳頁的訂單明細：依實際寄出的包裹分組，每包寫多久到店、取貨時付多少。
 * 只在一張訂單會分成兩包以上時使用。
 */
export function CheckoutPackages({ packages, compact = false }: { packages: ShipPackage<PackageLine>[]; compact?: boolean }) {
  return (
    <div>
      <div className="mb-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3.5 py-3">
        <p className="text-[15px] font-bold text-amber-900">📦 這筆訂單會分 {packages.length} 個包裹寄出</p>
        <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
          {mixed(packages) ? '現貨和預購分開寄，' : ''}會<b>分開到店、分開付款</b>，加起來就是訂單總額。
        </p>
      </div>
      <div className="space-y-2.5">
        {packages.map((p, i) => {
          const t = tone(p.kind)
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-gray-200">
              <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-3.5 py-2.5 ${t.head}`}>
                <p className={`text-[15px] font-bold ${t.text}`}>
                  包裹 {i + 1}
                  {p.kind && <span className={`ml-2 rounded px-1.5 py-0.5 text-[12px] text-white ${t.badge}`}>{p.kind}</span>}
                </p>
                {packageEta(p) && <p className={`text-[13px] font-bold ${t.text}`}>{packageEta(p)}</p>}
              </div>
              <ul className="divide-y divide-gray-100">
                {p.items.map(it => (
                  <li key={it.key} className="flex items-center gap-3 px-3.5 py-2.5">
                    {!compact && (
                      <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {it.image
                          ? <Image src={it.image} alt={it.name} fill className="object-cover" sizes="44px" />
                          : <span className="flex h-full w-full items-center justify-center">💊</span>}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[14px] font-semibold leading-snug text-gray-800">{it.name}</span>
                      <span className="block text-[13px] text-gray-500">{it.variant ? `${it.variant} ` : ''}× {it.quantity}</span>
                    </span>
                    <span className="flex-shrink-0 text-[14px] font-bold text-gray-900 tabular-nums">{formatPrice(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-dashed border-gray-200 px-3.5 py-2 text-[14px]">
                <span className="text-gray-600">這包取貨時付</span>
                <b className={`tabular-nums ${t.text}`}>{formatPrice(p.amount)}</b>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 下單成功頁的提醒卡：告訴客人會分幾次取貨付款、每次多少，
 * 避免先到的那包金額比較少，客人以為寄錯。
 */
export function SuccessPackages({ packages, total }: { packages: ShipPackage<PackageLine>[]; total: number }) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-sm">
      <div className="bg-amber-50 px-5 py-4">
        <p className="text-lg font-bold text-amber-900">⚠️ 請注意：會分 {packages.length} 次取貨付款</p>
        <p className="mt-1 text-[14px] leading-relaxed text-amber-900">
          {mixed(packages) ? '您同時買了現貨和預購商品，' : '這筆訂單的商品從不同地方出貨，'}我們會分成 {packages.length} 個包裹寄出。
          <b>先到的包裹金額比較少是正常的，不是寄錯喔！</b>
        </p>
      </div>
      <ol className="divide-y divide-gray-100">
        {packages.map((p, i) => {
          const t = tone(p.kind)
          return (
            <li key={i} className="flex gap-3 px-5 py-4">
              <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${t.dot}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900">{p.kind ? `${p.kind}包裹` : `包裹 ${i + 1}`}{packageEta(p) && `・${packageEta(p)}`}</p>
                <ul className="mt-0.5 text-[14px] leading-relaxed text-gray-600">
                  {p.items.map(it => <li key={it.key}>{it.name}{it.variant ? `（${it.variant}）` : ''} ×{it.quantity}</li>)}
                </ul>
                <p className={`mt-1.5 inline-block rounded-lg px-2.5 py-1 text-[15px] font-bold tabular-nums ${t.pay}`}>取貨時付 {formatPrice(p.amount)}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-[13px] leading-relaxed text-gray-600">
        每個包裹到店時，7-11 都會各傳一封簡訊。{packages.length} 次合計 <b className="text-gray-900">{formatPrice(total)}</b>，就是這筆訂單的總金額。
      </div>
    </div>
  )
}
