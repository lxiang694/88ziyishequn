import type { Metadata } from 'next'
import { careBrand } from '@/lib/careBrand'
import FamilyServiceClient from '@/components/care/FamilyServiceClient'

export const metadata: Metadata = {
  title: `服務進度｜${careBrand.name}`,
  description: '已授權的家屬可在此查看單筆服務的已發布進度與服務小結。',
  robots: { index: false, follow: false },
}

export default function FamilyServicePage({ params }: { params: { id: string } }) {
  return <FamilyServiceClient bookingId={params.id} />
}
