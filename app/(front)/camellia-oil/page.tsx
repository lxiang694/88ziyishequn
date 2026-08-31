import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import { PRESALE } from '@/lib/presale/camelliaOil'
import PresaleBuyBox from '@/components/front/PresaleBuyBox'
import SocialShareButtons from '@/components/front/SocialShareButtons'

export const dynamic = 'force-dynamic'

const SITE_URL = 'https://healthec.vercel.app'
const PAGE_URL = `${SITE_URL}/camellia-oil`

const getProduct = cache(async () => {
  const { data } = await supabaseAdmin
    .from('products')
    .select(`
      id, product_name, slug, short_intro, cover_image_url, is_published,
      product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active),
      product_images(id, image_url, sort_order)
    `)
    .eq('slug', PRESALE.productSlug)
    .maybeSingle()
  return data as any
})

export async function generateMetadata(): Promise<Metadata> {
  const p = await getProduct()
  const description =
    `${PRESALE.displaySpec} ${PRESALE.title}預售中，預計 ${PRESALE.shipMonth} 出貨。`
    + '山上野生老茶樹，一年一收，果實自然裂開才採。'
  return {
    title: `${PRESALE.title}預售 | 健康優選`,
    description,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: `${PRESALE.title}．${PRESALE.displaySpec} 預售`,
      description,
      url: PAGE_URL,
      siteName: '健康優選',
      locale: 'zh_TW',
      type: 'website',
      images: p?.cover_image_url ? [{ url: p.cover_image_url, width: 1200, height: 630 }] : [],
    },
  }
}

export default async function CamelliaOilPresalePage() {
  const product = await getProduct()

  const gallery: { id: number; image_url: string }[] =
    (product?.product_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order)

  const ready = !!product && product.is_published
    && Array.isArray(product.product_variants) && product.product_variants.length > 0

  const jsonLd = ready
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.product_name,
        image: product.cover_image_url ? [product.cover_image_url] : undefined,
        description: product.short_intro || undefined,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'TWD',
          price: Math.min(...product.product_variants.filter((v: any) => v.is_active)
            .map((v: any) => v.sale_price)),
          availability: 'https://schema.org/PreOrder',
          url: PAGE_URL,
        },
      }
    : null

  return (
    <div className="bg-white pb-24 lg:pb-0">
      {jsonLd && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-10 sm:pt-12">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-green-700">首頁</Link>
            <span>›</span>
            <span className="text-gray-700">{PRESALE.title}預售</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div>
              <span className="inline-block bg-amber-100 text-amber-800 text-sm font-bold px-3 py-1 rounded-full mb-4">
                🌿 今年只有這一批
              </span>
              <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
                {PRESALE.title}
              </h1>
              <p className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-6">
                {PRESALE.subtitle}
              </p>

              <div className="space-y-2 mb-8">
                {PRESALE.wildClaims.map(c => (
                  <p key={c} className="flex gap-3 text-gray-700 text-[17px] leading-relaxed">
                    <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                    <span>{c}</span>
                  </p>
                ))}
              </div>

              {(PRESALE.origin || PRESALE.pressing || PRESALE.testing) && (
                <dl className="grid sm:grid-cols-2 gap-3 mb-8">
                  {PRESALE.origin && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                      <dt className="text-[13px] text-gray-500">產地</dt>
                      <dd className="font-semibold text-gray-800">{PRESALE.origin}</dd>
                    </div>
                  )}
                  {PRESALE.pressing && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                      <dt className="text-[13px] text-gray-500">榨油方式</dt>
                      <dd className="font-semibold text-gray-800">{PRESALE.pressing}</dd>
                    </div>
                  )}
                  {PRESALE.testing && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:col-span-2">
                      <dt className="text-[13px] text-gray-500">檢驗</dt>
                      <dd className="font-semibold text-gray-800">{PRESALE.testing}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {/* 購買區 */}
            <div className="lg:sticky lg:top-24">
              {product?.cover_image_url && (
                <div className="aspect-square rounded-3xl overflow-hidden bg-gray-100 relative mb-5">
                  <Image src={product.cover_image_url} alt={PRESALE.title}
                    fill priority className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 480px" />
                </div>
              )}

              {ready ? (
                <PresaleBuyBox product={product} shipMonth={PRESALE.shipMonth} />
              ) : (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6">
                  <p className="font-bold text-amber-900 mb-2">⚙️ 商品尚未建立</p>
                  <p className="text-amber-800 text-[15px] leading-relaxed">
                    這一頁的文案已經就緒，但還沒有對應的商品資料，所以無法下單。
                    請到後台「商品管理」新增一個 slug 為
                    <code className="bg-white px-1.5 py-0.5 rounded mx-1 font-mono text-[13px]">
                      {PRESALE.productSlug}
                    </code>
                    的商品，設定 {PRESALE.displaySpec} 規格、售價與預售數量並上架。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 採收實況 ────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">山上現在的樣子</h2>
          <p className="text-gray-600 text-[17px] leading-relaxed mb-6">
            這些是採收現場拍的。果實會自己裂開，露出裡面的黑籽 ——
            那是它熟了的訊號，也是可以採的訊號。
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map(img => (
              <div key={img.id} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 relative">
                <Image src={img.image_url} alt={PRESALE.title} fill className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 這瓶油是什麼 ────────────────────────────────── */}
      <section className="bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">關於這瓶油</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {PRESALE.facts.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-gray-900 text-lg mb-2 leading-snug">{f.title}</h3>
                <p className="text-gray-600 text-[15px] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 怎麼用 ──────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">買回去怎麼用</h2>
        <p className="text-gray-600 text-[17px] mb-6">日常都用得到，不必留著等特別的日子。</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {PRESALE.usages.map(u => (
            <div key={u.title} className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-5">
              <span className="text-3xl flex-shrink-0">{u.emoji}</span>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">{u.title}</h3>
                <p className="text-gray-600 text-[15px] leading-relaxed">{u.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 預售時程 ────────────────────────────────────── */}
      <section className="bg-green-50">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">從樹上到您手上</h2>
          <p className="text-gray-700 text-[17px] leading-relaxed mb-8">
            這是預售，因為油還沒榨。下面每一步都急不得 ——
            提早做只會讓油變差，所以我們選擇讓您先排隊，而不是先出貨。
          </p>
          <ol className="space-y-4">
            {PRESALE.timeline.map((t, i) => (
              <li key={t.label} className="flex gap-4 bg-white rounded-2xl p-5 border border-green-100">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-green-700 text-white font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold text-gray-900">
                    {t.label}
                    <span className="ml-2 text-[13px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      {t.month}
                    </span>
                  </p>
                  <p className="text-gray-600 text-[15px] leading-relaxed mt-1">{t.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">常見問題</h2>
        <div className="space-y-3">
          {PRESALE.faqs.map(f => (
            <details key={f.q} className="bg-white border border-gray-200 rounded-2xl overflow-hidden group">
              <summary className="cursor-pointer list-none px-5 py-4 font-bold text-gray-900 flex items-center justify-between gap-3 min-h-[56px]">
                <span>{f.q}</span>
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl flex-shrink-0">＋</span>
              </summary>
              <p className="px-5 pb-5 text-gray-700 text-[16px] leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── 收尾 CTA ───────────────────────────────────── */}
      {ready && (
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <div className="bg-gradient-to-br from-green-700 to-emerald-600 rounded-3xl p-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">今年這一批，採完就沒有了</h2>
            <p className="text-green-50 text-[17px] leading-relaxed mb-6">
              野生茶樹一年一收，落果量看天。現在預訂，{PRESALE.shipMonth} 新油出來直接寄給您。
            </p>
            <div className="bg-white rounded-2xl p-5 text-left">
              <PresaleBuyBox product={product} shipMonth={PRESALE.shipMonth} />
            </div>
          </div>
        </section>
      )}

      <div className="max-w-3xl mx-auto px-4">
        <SocialShareButtons
          url={PAGE_URL}
          title={`${PRESALE.title}．${PRESALE.displaySpec} 預售中`}
          heading="有喜歡煮菜的朋友嗎"
          subtext="這一批數量有限，分享給他"
          theme="green"
        />
      </div>

      {/* ── 法規聲明 ───────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm text-amber-700 font-semibold mb-1">⚠️ 商品聲明</p>
          <p className="text-[13px] text-amber-700 leading-relaxed">{PRESALE.disclaimer}</p>
        </div>
      </div>

      {/* 行動版底部購買列 */}
      {ready && <PresaleBuyBox product={product} shipMonth={PRESALE.shipMonth} sticky />}
    </div>
  )
}
