import type { ReactNode } from 'react'
import CareSiteShell from '@/components/care/CareSiteShell'

/**
 * /care 專屬 route group。
 * 與商城的 (front) 分開，因此不會載入 FrontShell 的購物車、商城導覽與商城頁尾。
 */
export default function CareLayout({ children }: { children: ReactNode }) {
  return <CareSiteShell>{children}</CareSiteShell>
}
