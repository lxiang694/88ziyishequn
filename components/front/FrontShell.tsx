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
      <footer className="bg-white border-t border-gray-100 mt-12 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-gray-500">
          <p className="font-bold text-gray-700 mb-1 text-base">健康優選｜88自醫社群團購賣場</p>
          <p className="text-sm">如有任何問題，請透過右下角 LINE 聯絡我們的客服人員</p>

          {/* 商品分類 —— 頁尾是客人捲到底時最常找入口的地方 */}
          <nav aria-label="商品分類" className="mt-6 border-t border-gray-100 pt-6">
            <h2 className="mb-3 text-sm font-bold text-gray-700">商品分類</h2>
            <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {SHOP_CATEGORIES.map(cat => (
                <li key={cat.slug}>
                  <a href={`/shop/${cat.slug}`}
                    className="inline-block rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:border-green-400 hover:text-green-700">
                    {cat.emoji} {cat.name}
                  </a>
                </li>
              ))}
              <li>
                <a href="/shop"
                  className="inline-block rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-800 transition-colors hover:border-green-400">
                  全部商品 →
                </a>
              </li>
            </ul>
          </nav>

          {/* Quick links — easy access without login */}
          <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 mt-6 text-sm">
            <a href="/orders" className="text-gray-600 hover:text-green-700 font-semibold">📦 訂單查詢</a>
            <span className="text-gray-300">·</span>
            <a href="/health-articles" className="text-gray-600 hover:text-green-700 font-semibold">📚 健康知識</a>
            <span className="text-gray-300">·</span>
            <a href="/sleep-quiz" className="text-gray-600 hover:text-green-700 font-semibold">🌙 睡眠自測</a>
            <span className="text-gray-300">·</span>
            <a href="/health-quiz" className="text-gray-600 hover:text-green-700 font-semibold">🩺 健康自測</a>
          </div>

          <p className="mt-4 text-[13px] text-gray-600">© {new Date().getFullYear()} 健康優選. All rights reserved.</p>
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
