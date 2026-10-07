'use client'
import type { ReactNode } from 'react'
import { CartProvider } from './CartContext'
import { UserAuthProvider } from './UserAuthContext'
import ClientErrorBoundary from './ClientErrorBoundary'
import SiteHeader from './SiteHeader'
import LineFloatButton from './LineFloatButton'
import MobileBottomNav from './MobileBottomNav'
import BackHomeNav from './BackHomeNav'
import { Toaster } from 'react-hot-toast'
// 直接用程式裡的那份清單，不打 API —— 頁尾在每一頁都會渲染，
// 為了一排連結讓每頁都多一次查詢並不划算，而分類本來就很少變動。
import { SHOP_CATEGORIES } from '@/lib/shopCategories'

export default function FrontShell({ children }: { children: ReactNode }) {
  return (
    <ClientErrorBoundary>
    <UserAuthProvider>
    <CartProvider>
      <SiteHeader />
      <BackHomeNav />
      {/* pt-16 / sm:pt-20 compensates for the fixed header height (h-16 / sm:h-20) */}
      <main className="min-h-screen pt-16 sm:pt-20">{children}</main>
      {/* 頁尾的客人以中高齡為主：每個入口都是一塊夠大的按鈕（至少 64px 高），
          排成整齊的格子 —— 原本長短不一的膠囊自動換行，排出來參差不齊，
          底下的快速連結又只是一行小字，看不出能點。 */}
      <footer className="bg-sage/60 border-t border-line mt-12 pt-8 pb-6">
        <div className="max-w-5xl mx-auto px-4">

          {/* 商品分類 —— 頁尾是客人捲到底時最常找入口的地方。
              九個分類在手機上剛好排成 3×3。 */}
          <nav aria-label="商品分類">
            <h2 className="mb-3 text-center text-base font-bold text-gray-800">商品分類</h2>
            <ul className="grid grid-cols-3 gap-2.5 md:grid-cols-9">
              {SHOP_CATEGORIES.map(cat => (
                <li key={cat.slug}>
                  <a href={`/shop/${cat.slug}`}
                    className="flex h-full min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white px-1 py-2.5 text-center shadow-sm transition-colors hover:border-green-400 active:bg-green-50">
                    <span className="text-[26px] leading-none" aria-hidden="true">{cat.emoji}</span>
                    <span className="text-[14px] font-bold leading-tight text-gray-800">{cat.name}</span>
                  </a>
                </li>
              ))}
            </ul>
            <a href="/shop"
              className="mt-2.5 flex min-h-[48px] items-center justify-center rounded-2xl bg-green-700 md:mx-auto md:max-w-xs text-[15px] font-bold text-white transition-colors hover:bg-green-800">
              瀏覽全部商品 →
            </a>
          </nav>

          {/* 常用服務 —— 不用登入就能用的入口，做成有說明的按鈕，一眼看得出能點 */}
          <nav aria-label="常用服務" className="mt-8">
            <h2 className="mb-3 text-center text-base font-bold text-gray-800">常用服務</h2>
            <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {[
                { href: '/orders', icon: '📦', label: '訂單查詢', hint: '用手機號碼查進度' },
                { href: '/health-articles', icon: '📚', label: '健康知識', hint: '保健觀念一次看懂' },
                { href: '/sleep-quiz', icon: '🌙', label: '睡眠自測', hint: '了解你的睡眠狀況' },
                { href: '/health-quiz', icon: '🩺', label: '健康自測', hint: '找適合的保養方向' },
              ].map(link => (
                <li key={link.href}>
                  <a href={link.href}
                    className="flex h-full min-h-[64px] items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-green-400 active:bg-green-50">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-canvas text-[22px]" aria-hidden="true">{link.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold leading-tight text-gray-800">{link.label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-gray-600">{link.hint}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-8 border-t border-line pt-5 text-center">
            <p className="text-base font-bold text-gray-800">健康優選｜88自醫社群團購賣場</p>
            <p className="mt-1 text-sm text-gray-600">有任何問題，請點右下角 LINE 聯絡客服</p>
            <p className="mt-3 text-[13px] text-gray-500">© {new Date().getFullYear()} 健康優選. All rights reserved.</p>
          </div>
        </div>
      </footer>
      {/* 底部導覽列高度的墊片，避免內容被固定列遮住（手機，含瀏海機安全區） */}
      <div className="md:hidden" aria-hidden style={{ height: 'calc(60px + env(safe-area-inset-bottom))' }} />
      <LineFloatButton />
      <MobileBottomNav />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '17px', padding: '16px 24px', borderRadius: '16px', maxWidth: '400px', fontWeight: '700', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
          success: { style: { background: '#15803d', color: '#ffffff', border: 'none' }, iconTheme: { primary: '#ffffff', secondary: '#15803d' } },
          error: { style: { background: '#b91c1c', color: '#ffffff', border: 'none' }, iconTheme: { primary: '#ffffff', secondary: '#b91c1c' } },
        }}
      />
    </CartProvider>
    </UserAuthProvider>
    </ClientErrorBoundary>
  )
}
