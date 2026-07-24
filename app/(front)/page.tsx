import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSalesMap } from '@/lib/salesUtils'
import HomeClient from '@/components/front/HomeClient'
import type { HealthCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function getInitialData() {
  const [productsRes, categoriesRes, salesMap] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select(`*,
        product_variants(id, variant_name, sale_price, original_price, stock_qty, sku_code, is_active),
        product_category_relations(health_categories(id, name, slug))`, { count: 'exact' })
      .eq('is_published', true)
      .limit(200),
    supabaseAdmin
      .from('health_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    buildSalesMap(),  // excludes cancelled orders automatically
  ])

  // 把銷量直接附加到每件商品上
  const withSales = (productsRes.data || []).map((p: any) => ({
    ...p,
    sales_count: salesMap[p.id] || 0,
  }))

  // 銷量高的排前面
  const sorted = withSales.sort((a: any, b: any) => b.sales_count - a.sales_count)

  return {
    initialProducts: sorted,
    initialTotal: productsRes.count ?? sorted.length,
    categories: (categoriesRes.data || []) as HealthCategory[],
  }
}

export default async function HomePage() {
  const { initialProducts, initialTotal, categories } = await getInitialData()
  return (
    <Suspense fallback={null}>
      <HomeClient
        initialProducts={initialProducts as any}
        initialTotal={initialTotal}
        categories={categories}
      />
    </Suspense>
  )
}
