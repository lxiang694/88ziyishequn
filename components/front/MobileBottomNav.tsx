'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from './CartContext'

const CATEGORY_ICONS: Record<string, string> = {
  'bone-joint': '🦴', 'cardiovascular': '❤️', 'digestive': '🫁',
  'immune': '🛡️', 'beauty-skin': '✨', 'eye-care': '👁️',
  'sleep-relax': '😴', 'weight-management': '⚖️', 'womens-health': '🌸',
  'mens-health': '💪', 'children-growth': '🌱', 'senior-health': '🏆',
}

export default function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { totalItems } = useCart()
  const [showCats, setShowCats] = useState(false)
  const [cats, setCats] = useState<any[]>([])

  useEffect(() => {
    if (showCats && cats.length === 0) {
      fetch('/api/categories').then(r => r.json()).then(d => { if (d.success) setCats(d.data) }).catch(() => {})
    }
  }, [showCats, cats.length])

  // 後台不顯示
  if (pathname.startsWith('/admin')) return null

  const isHome = pathname === '/'
  const isCart = pathname === '/cart'
  const isAccount = pathname.startsWith('/account')

  const goCategory = (slug: string) => {
    setShowCats(false)
    router.push(`/?cat=${encodeURIComponent(slug)}`)
  }

  const itemCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${active ? 'text-green-700' : 'text-gray-400'}`

  return (
    <>
      {/* 分類 bottom sheet */}
      {showCats && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setShowCats(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl p-4 pb-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pb-2"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 text-lg">依健康方向選購</h3>
              <button onClick={() => setShowCats(false)} className="text-gray-400 text-xl w-8 h-8">✕</button>
            </div>
            {cats.length === 0 ? (
              <p className="text-center text-gray-400 py-8">載入中...</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                {cats.map(c => (
                  <button key={c.id} onClick={() => goCategory(c.slug)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 border-gray-100 hover:border-green-300 active:bg-green-50 transition-colors">
                    <span className="text-2xl">{CATEGORY_ICONS[c.slug] || '💊'}</span>
                    <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 底部固定導覽列（手機／平板） */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ height: 60, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch h-full max-w-5xl mx-auto">
          <Link href="/" className={itemCls(isHome)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" /></svg>
            <span className="text-xs font-semibold">首頁</span>
          </Link>
          <button onClick={() => setShowCats(true)} className={itemCls(false)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span className="text-xs font-semibold">分類</span>
          </button>
          <Link href="/cart" className={itemCls(isCart)}>
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{totalItems > 9 ? '9+' : totalItems}</span>
              )}
            </div>
            <span className="text-xs font-semibold">購物車</span>
          </Link>
          <Link href="/account" className={itemCls(isAccount)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-xs font-semibold">會員</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
