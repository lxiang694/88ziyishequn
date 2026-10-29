'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from './CartContext'
import { useKeyboardOpen } from './useKeyboardOpen'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { totalItems } = useCart()
  // 打字時（鍵盤開著）隱藏，避免蓋住輸入框；判斷方式見 useKeyboardOpen
  const inputFocused = useKeyboardOpen()

  // 後台不顯示
  if (pathname.startsWith('/admin')) return null
  // 商品頁、團購頁底部有自己的固定購買列，兩條疊在一起會擋住半個畫面
  if (pathname.startsWith('/products/') || pathname.startsWith('/group-buy/')) return null

  const isHome = pathname === '/'
  const isShop = pathname.startsWith('/shop')
  const isCart = pathname === '/cart'
  const isAccount = pathname.startsWith('/account')

  const items = [
    { href: '/', label: '首頁', active: isHome, icon: ICONS.home },
    // 直接進賣場。/shop 一進去左邊就是完整分類欄，再疊一層彈出選單只是多一次點擊
    { href: '/shop', label: '商品分類', active: isShop, icon: ICONS.shop },
    { href: '/cart', label: '購物車', active: isCart, icon: ICONS.cart, badge: totalItems },
    { href: '/account', label: '會員', active: isAccount, icon: ICONS.account },
  ]

  return (
    /*
      底部固定導覽列（手機／平板）。

      高度 = 按鈕列固定 60px ＋ iPhone 底部安全區（home 橫條那一段）。
      以前是整條固定 60px、安全區的 padding 算在裡面：iOS Safari 往上滑、
      工具列收起來時安全區變成約 34px，按鈕只剩 26px，圖示被擠出去、
      字也歪掉。現在安全區另外加在按鈕列下面，按鈕永遠是完整的 60px。
      （購物車、結帳頁的底部列、LINE 按鈕都是用 60px + 安全區定位，剛好對齊）
    */
    <nav aria-label="主要選單"
      className={`fixed inset-x-0 bottom-0 z-40 bottom-skirt border-t border-gray-200/80 bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden ${inputFocused ? 'hidden' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-5xl items-stretch">
        {items.map(it => (
          <li key={it.href} className="flex-1">
            <Link href={it.href} aria-current={it.active ? 'page' : undefined}
              className={`flex h-full flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-50 ${it.active ? 'text-green-700' : 'text-gray-500'}`}>
              {/* 目前所在的頁面：圖示後面一塊淡綠色膠囊 */}
              <span className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${it.active ? 'bg-green-100' : ''}`}>
                <svg className="h-[22px] w-[22px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={it.active ? 2.4 : 2} viewBox="0 0 24 24" aria-hidden>
                  {it.icon}
                </svg>
                {!!it.badge && (
                  <span className="absolute -top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">
                    {it.badge > 9 ? '9+' : it.badge}
                  </span>
                )}
              </span>
              <span className={`text-[12px] leading-none ${it.active ? 'font-bold' : 'font-semibold'}`}>{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const ICONS = {
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v9.5a1 1 0 0 0 1 1H10v-5.5h4v5.5h3.5a1 1 0 0 0 1-1V10" />,
  shop: <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4zM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4z" />,
  cart: <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />,
  account: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />,
}
