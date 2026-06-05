import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import ProductDetailClient from '@/components/front/ProductDetailClient'

const SITE_URL = 'https://healthec.vercel.app'

// ⚠️ 關鍵：強制動態渲染。
// 商品的 metadata 用 supabaseAdmin 查庫（Next 無法追蹤的外部請求），
// 若不加這行，Next 會把整條路由當靜態頁，把「首次渲染的結果」永久快取住——
// 導致首次渲染時尚未建立/查不到的商品，OG 標籤被凍結成「找不到商品」的兜底，
// LINE / FB 分享就只剩全站預設圖文。加這行後每次請求都重新產生正確的 OG。
export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug)

  const { data: product } = await supabaseAdmin
    .from('products')
    .select(`
      product_name, short_intro, cover_image_url, slug,
      product_variants(sale_price, is_active),
      product_images(image_url, sort_order)
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (!product) {
    return { title: '商品' }
  }

  // 最低售價當「起」價
  const prices = (product.product_variants || [])
    .filter((v: any) => v.is_active)
    .map((v: any) => v.sale_price)
    .filter((p: number) => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : null
  const priceText = minPrice != null ? `NT$${minPrice.toLocaleString('en-US')} 起` : ''

  // 描述：價格 ｜ 簡介 ｜ 取貨賣點
  const description = [
    priceText,
    product.short_intro || `${product.product_name}，健康優選嚴選保健品`,
    '7-11 門市取貨・免帳號直接下單',
  ].filter(Boolean).join('｜')

  // 預覽圖：封面優先，再附相簿其餘圖（爬蟲通常取第一張）
  const gallery = (product.product_images || [])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((i: any) => i.image_url)
  const imageUrls: string[] = [product.cover_image_url, ...gallery].filter(Boolean)
  const ogImages = imageUrls.map((url) => ({ url, width: 800, height: 800, alt: product.product_name }))

  // og:title 帶上價格更吸睛；頁面 <title> 走 layout 的 "%s | 健康優選" 模板，這裡只給商品名避免重複
  const ogTitle = `${product.product_name}${priceText ? `（${priceText}）` : ''}｜健康優選`

  return {
    title: product.product_name,
    description,
    alternates: { canonical: `${SITE_URL}/products/${product.slug}` },
    openGraph: {
      title: ogTitle,
      description,
      url: `${SITE_URL}/products/${product.slug}`,
      siteName: '健康優選',
      images: ogImages,
      locale: 'zh_TW',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: imageUrls,
    },
  }
}

// Page 本身不需 async：渲染 client 元件，由它走 API route 抓資料。
// 即使 metadata 的 Supabase 查詢失敗，頁面也不會 404。
export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  return <ProductDetailClient slug={params.slug} />
}
