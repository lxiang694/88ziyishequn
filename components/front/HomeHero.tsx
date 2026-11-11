'use client'
import { Fragment, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/lib/utils'
import { campaignPhase } from '@/lib/groupBuy/domain'
import type { CampaignTeaser } from '@/lib/groupBuy/repo'

interface HeroProduct {
  id: number
  product_name: string
  slug: string
  cover_image_url: string | null
  product_variants: { is_active: boolean; stock_qty: number; sale_price: number }[]
  sales_count?: number
  /** 伺服器斷好的詞（lib/wordBreak.ts）；沒有時整個品名當一個詞 */
  name_segments?: string[]
}

/** 銷量到這個數字才寫「N 人買過」—— 太少的數字反而扣分 */
const SOLD_MIN = 5

/**
 * 首頁第一屏（方案 A：信任＋直接買）。
 *
 * 第一屏要讓第一次來的客人在三秒內知道三件事：
 *   1. 這裡賣什麼（日常吃的、用的，幫你挑過）
 *   2. 怎麼買、安不安心（7-11 取貨付款、免註冊、LINE 客服）—— 以前放在最下面一排小灰字
 *   3. 從哪裡開始（熱銷三件，直接加入購物車）
 * 有團購開團時，最上面多一條細長的提醒；沒開團就不出現。
 *
 * 文案只講挑選、取貨、付款，不寫功效（食品廣告不得宣稱療效）。
 */
export default function HomeHero({ products, onShop, onAddToCart, groupBuy = null }: {
  products: HeroProduct[]
  onShop: () => void
  onAddToCart: (product: HeroProduct) => void
  groupBuy?: CampaignTeaser | null
}) {
  const featured = products.filter(p => p.cover_image_url && p.product_variants.some(v => v.is_active && v.stock_qty > 0)).slice(0, 3)

  return (
    <section aria-labelledby="home-hero-title" className="border-b border-line bg-canvas text-[#173e30]">
      <GroupBuyStrip campaign={groupBuy} />
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-5 sm:py-10 lg:py-12">
        <div className={`grid gap-5 sm:gap-8 ${featured.length ? 'lg:grid-cols-[1.05fr_1fr] lg:items-center' : ''}`}>
          <div>
            <p className="mb-2 text-[13px] font-bold tracking-wider text-[#5b7a5f] sm:text-sm">88 自醫社群</p>
            {/* 兩行長度相近、行尾不懸逗號；整段同一個深綠，不再分兩種綠 */}
            <h1 id="home-hero-title" className="text-[26px] sm:text-[40px] lg:text-[42px] leading-[1.3] font-bold tracking-tight">
              每天要吃的、要用的，<br />幫你先挑好。
            </h1>
            <p className="mt-2 text-[16px] sm:text-lg leading-relaxed text-[#4a5d4d]">
              社群團購價，7-11 取貨再付款。
            </p>

            {/* 安心購物三件事：從原本最下面移上來，做成看得到的小標籤 */}
            <ul aria-label="購物服務" className="mt-3 flex flex-wrap gap-1.5">
              {['7-11 取貨付款', '免註冊下單', 'LINE 客服'].map(label => (
                <li key={label} className="inline-flex items-center gap-1 rounded-full bg-[#e6efe4] px-2.5 py-1 text-[13px] font-semibold text-[#2f5a3c]">
                  <CheckIcon className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />{label}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 sm:mt-6">
              <button type="button" onClick={onShop} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#214e39] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[#153a29] focus-visible:outline-offset-4">
                看熱銷商品 <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <Link href="/health-quiz" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-[#365f43] underline-offset-4 hover:underline">
                幫我挑 <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {featured.length > 0 && (
            <div className="min-w-0 lg:rounded-[28px] lg:bg-sage lg:p-5">
              <h2 className="mb-2 text-[15px] font-bold text-[#284b36] lg:mb-3">大家都在買</h2>
              <ul className="grid grid-cols-3 gap-2 sm:gap-3">
                {featured.map((product, index) => {
                  const available = product.product_variants.filter(v => v.is_active && v.stock_qty > 0)
                  const price = Math.min(...available.map(v => v.sale_price))
                  const priceVaries = new Set(available.map(v => v.sale_price)).size > 1
                  const sold = product.sales_count || 0
                  const segments = product.name_segments?.length ? product.name_segments : [product.product_name.replace(/^【小莊代購】\s*/, '')]
                  return (
                    <li key={product.id} className="flex min-w-0 flex-col rounded-xl bg-white p-2 shadow-sm sm:p-3 lg:rounded-2xl">
                      <Link href={`/products/${product.slug}`} className="group block">
                        {/*
                          圖框接近正方形、底色極淺米色：商品照多是方形或直式，
                          NAC、綜合維生素這類去背白底的照片放在白卡片上會沒有邊界。
                        */}
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-paper">
                          <Image src={product.cover_image_url!} alt={product.product_name} fill priority={index === 0} sizes="(max-width: 640px) 30vw, 150px" className="object-contain p-1" />
                        </div>
                        {/* 只在詞與詞之間換行：「6合一綜合／維生素」，不會斷成「…維生／素」 */}
                        <p className="mt-1.5 line-clamp-2 min-h-[36px] text-[13px] leading-[18px] font-semibold text-[#284b36] [word-break:keep-all] [overflow-wrap:anywhere] [@media(hover:hover)]:group-hover:underline">
                          {segments.map((s, i) => <Fragment key={i}>{i > 0 && <wbr />}{s}</Fragment>)}
                        </p>
                      </Link>
                      <p className="mt-0.5 h-4 truncate text-[12px] leading-4 text-[#9a5b16]">{sold >= SOLD_MIN ? `🔥 ${sold} 人買過` : ''}</p>
                      <p className="mt-0.5 text-[15px] font-bold tabular-nums text-[#214e39]">
                        {formatPrice(price)}{priceVaries && <span className="ml-0.5 text-xs font-normal">起</span>}
                      </p>
                      <button type="button" onClick={() => onAddToCart(product)}
                        className="mt-1.5 min-h-[38px] w-full rounded-lg border-2 border-[#214e39] text-[13px] font-bold text-[#214e39] active:bg-green-50 sm:text-sm">
                        {available.length > 1 ? '選規格' : '＋ 購物車'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * 最上面的團購細長條：只有「開團中」才出現，寫剩幾天，點了到團購頁。
 * 狀態在客人手機上即時算（首頁快取 60 秒，不能在伺服器算好）。
 */
function GroupBuyStrip({ campaign }: { campaign: CampaignTeaser | null }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  if (!campaign || !now || campaignPhase(campaign, now) !== 'open') return null
  const ms = new Date(campaign.ends_at).getTime() - now.getTime()
  const h = Math.floor(ms / 3600_000)
  const left = h >= 24 ? `剩 ${Math.floor(h / 24)} 天` : h >= 1 ? `剩 ${h} 小時` : '即將截單'
  return (
    <Link href="/group-buy" className="flex items-center justify-center gap-2 bg-[#214e39] px-4 py-2 text-[14px] font-semibold text-white">
      <span className="truncate">🔥 每月團購開團中・{left}</span>
      <span className="flex-shrink-0 rounded-full bg-amber-300 px-2.5 py-0.5 text-[13px] font-bold text-amber-950">看看 →</span>
    </Link>
  )
}
