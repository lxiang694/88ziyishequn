'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from './CartContext'
import { formatPrice } from '@/lib/utils'

/**
 * Floating cart shortcut at bottom-right (above the LINE button).
 * - Only visible when cart has items
 * - Bounces when count increases — instant visual feedback after "加入購物車"
 * - Shows item count + total amount at a glance
 * - Auto-hidden on /cart, /checkout, /admin (where it would be redundant)
 */
export default function CartFloatButton() {
  const pathname = usePathname()
  const { totalItems, totalAmount } = useCart()
  const [bounce, setBounce] = useState(false)
  const prevCount = useRef(0)

  useEffect(() => {
    // Trigger bounce only when count INCREASES (i.e. user just added something)
    if (totalItems > prevCount.current && totalItems > 0) {
      setBounce(true)
      const t = setTimeout(() => setBounce(false), 1500)
      prevCount.current = totalItems
      return () => clearTimeout(t)
    }
    prevCount.current = totalItems
  }, [totalItems])

  // Don't show when empty, on cart/checkout/admin (redundant there)
  if (totalItems === 0) return null
  if (pathname === '/cart' || pathname === '/checkout' || pathname === '/order-success') return null
  if (pathname.startsWith('/admin')) return null

  return (
    <Link
      href="/cart"
      aria-label={`查看購物車，共 ${totalItems} 件商品`}
      className={`fixed z-45 flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white rounded-full shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 ${bounce ? 'animate-bounce' : ''}`}
      style={{ bottom: '144px', right: '16px', padding: '10px 16px' }}
    >
      {/* Cart icon */}
      <div className="relative">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {/* Count badge */}
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[12px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shadow-md ring-2 ring-white">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      </div>

      {/* Count + amount */}
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[13px] font-bold">查看購物車</span>
        <span className="text-sm font-bold">{formatPrice(totalAmount)}</span>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
