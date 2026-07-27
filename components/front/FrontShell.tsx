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

          {/* Quick links — easy access without login */}
          <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 mt-4 text-sm">
            <a href="/orders" className="text-gray-600 hover:text-green-700 font-semibold">📦 訂單查詢</a>
            <span className="text-gray-300">·</span>
            <a href="/health-articles" className="text-gray-600 hover:text-green-700 font-semibold">📚 健康知識</a>
            <span className="text-gray-300">·</span>
            <a href="/sleep-quiz" className="text-gray-600 hover:text-green-700 font-semibold">🌙 睡眠自測</a>
            <span className="text-gray-300">·</span>
            <a href="/health-quiz" className="text-gray-600 hover:text-green-700 font-semibold">🩺 健康自測</a>
          </div>

          <p className="mt-4 text-xs text-gray-400">© {new Date().getFullYear()} 健康優選. All rights reserved.</p>
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
