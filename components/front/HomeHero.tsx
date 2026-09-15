'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRightIcon, BuildingStorefrontIcon, ChatBubbleLeftRightIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/lib/utils'

interface HeroProduct {
  id: number
  product_name: string
  slug: string
  cover_image_url: string | null
  product_variants: { is_active: boolean; stock_qty: number; sale_price: number }[]
}

export default function HomeHero({ products, onShop }: { products: HeroProduct[]; onShop: () => void }) {
  const featured = products.filter(p => p.cover_image_url && p.product_variants.some(v => v.is_active && v.stock_qty > 0)).slice(0, 3)

  return (
    <section aria-labelledby="home-hero-title" className="border-b border-[#e1e5d9] bg-[#f7f6ee] text-[#173e30]">
      <div className="max-w-5xl mx-auto px-4 pt-5 pb-3 sm:py-10 lg:py-12">
        <div className={`grid gap-4 sm:gap-8 ${featured.length ? 'lg:grid-cols-[1.05fr_1fr] lg:items-center' : ''}`}>
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wider text-[#49634d]">
              <span aria-hidden="true" className="h-px w-6 bg-[#829471]" />
              88 自醫社群・日常好物精選
            </p>
            <h1 id="home-hero-title" className="text-[32px] sm:text-[42px] lg:text-[44px] leading-[1.3] font-bold tracking-tight">
              為自己，也為家人，<br />
              <span className="text-[#437451]">選好日常營養。</span>
            </h1>
            <p className="mt-3 max-w-sm text-[15px] sm:text-base leading-relaxed text-[#536455]">
              從日常保健到餐桌好物，<br className="hidden lg:block" />讓每一次選購，都簡單一點。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <button type="button" onClick={onShop} className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-xl bg-[#214e39] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[#153a29] focus-visible:outline-offset-4">
                選購人氣商品 <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <Link href="/health-quiz" className="inline-flex min-h-[44px] items-center gap-1 border-b border-transparent text-sm font-semibold text-[#365f43] hover:border-[#365f43]">
                不知道怎麼選？ <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {featured.length > 0 && (
            <div className="min-w-0 lg:rounded-[28px] lg:bg-[#e9edde] lg:p-5">
              <div className="mb-2 flex items-center justify-between lg:mb-4">
                <h2 className="text-xs font-semibold tracking-widest text-[#536455]">從這幾款開始逛</h2>
                <span aria-hidden="true" className="text-xs text-[#536455]">日常精選 / {String(featured.length).padStart(2, '0')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {featured.map((product, index) => {
                  const available = product.product_variants.filter(v => v.is_active && v.stock_qty > 0)
                  const price = Math.min(...available.map(v => v.sale_price))
                  return (
                    <Link key={product.id} href={`/products/${product.slug}`} className="group min-w-0 rounded-xl bg-white p-2 sm:p-3 transition-shadow hover:shadow-md lg:rounded-2xl">
                      <div className="relative mx-auto h-[48px] sm:h-[100px] lg:h-[128px] w-full overflow-hidden rounded-lg bg-white">
                        <Image src={product.cover_image_url!} alt={product.product_name} fill priority={index === 0} sizes="(max-width: 640px) 28vw, 140px" className="object-contain" />
                      </div>
                      <p className="mt-2 line-clamp-2 min-h-[36px] text-[13px] leading-[18px] font-semibold text-[#284b36] group-hover:underline">{product.product_name.replace(/^【小莊代購】\s*/, '')}</p>
                      <p className="mt-1 text-[13px] sm:text-sm font-bold tabular-nums text-[#214e39]">{formatPrice(price)}{available.length > 1 && <span className="ml-0.5 text-xs font-normal">起</span>}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <ul aria-label="購物服務" className="mt-5 grid grid-cols-3 gap-2 border-t border-[#dce2d4] pt-3 sm:mt-7 sm:pt-4">
          {[
            { Icon: BuildingStorefrontIcon, label: '7-11 取貨付款' },
            { Icon: ShoppingBagIcon, label: '免註冊下單' },
            { Icon: ChatBubbleLeftRightIcon, label: 'LINE 客服' },
          ].map(({ Icon, label }) => (
            <li key={label} className="flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap text-[12px] sm:text-sm font-medium text-[#36513d]">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 max-[360px]:hidden" aria-hidden="true" />{label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
