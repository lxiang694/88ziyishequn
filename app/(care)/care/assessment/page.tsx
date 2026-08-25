import type { Metadata } from 'next'
import { careBrand } from '@/lib/careBrand'
import { CarePageHero } from '@/components/care/CareUI'
import AssessmentForm from '@/components/care/AssessmentForm'

export const metadata: Metadata = {
  title: `需求初步評估｜${careBrand.name}`,
  description: '用三個步驟描述就醫情境與協助需求，由專人確認服務適配性與完整費用。送出評估尚未成立預約，也不需先付款。',
}

export default function CareAssessmentPage() {
  return (
    <>
      <CarePageHero
        eyebrow="第一步"
        title="需求初步評估"
        lead="三個步驟，約一分鐘。先讓我們了解就醫情境與需要的協助，再由專人與您確認可服務範圍與完整費用。"
      />
      <AssessmentForm />
    </>
  )
}
