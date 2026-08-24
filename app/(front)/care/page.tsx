import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import CareClient from '@/components/front/CareClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '陪診服務｜健康優選 88自醫社群',
  description: '一個人跑醫院不再慌張。專業陪診員全程陪同掛號、看診、檢查、領藥，並即時回報家屬。全台主要縣市可預約。',
}

export default async function CarePage() {
  const { data } = await supabaseAdmin
    .from('care_services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (
    <Suspense fallback={null}>
      <CareClient services={data || []} />
    </Suspense>
  )
}
