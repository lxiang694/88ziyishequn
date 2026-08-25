import type { ReactNode } from 'react'
import CareHeader from './CareHeader'
import CareFooter from './CareFooter'
import CareMobileCTA from './CareMobileCTA'

/**
 * 陪診品牌前台外殼。
 *
 * 刻意不重用商城的 FrontShell：那裡帶著 CartProvider、商城導覽、
 * 商城頁尾與商城的手機底部列，全部都不該出現在 /care。
 */
export default function CareSiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen">
      <CareHeader />
      {/* pt 對應固定頁首高度（h-16 / sm:h-20） */}
      <main id="care-main" className="pt-16 sm:pt-20">{children}</main>
      <CareFooter />
      {/* 手機底部行動列的等高墊片，避免蓋住頁尾連結（含瀏海機安全區） */}
      <div className="md:hidden" aria-hidden="true"
        style={{ height: 'calc(64px + env(safe-area-inset-bottom))' }} />
      <CareMobileCTA />
    </div>
  )
}
