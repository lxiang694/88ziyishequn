'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/components/front/CartContext'
import { formatPrice } from '@/lib/utils'

export default function CartPage() {
  const { items, removeItem, updateQty, totalAmount } = useCart()

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="text-7xl mb-6">🛒</div>
        <h2 className="text-2xl font-bold text-gray-700 mb-3">購物車是空的</h2>
        <p className="text-gray-500 mb-8 text-lg">快去選購您喜愛的保健品吧！</p>
        <Link href="/" className="btn-primary text-xl px-10">去逛逛</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32 sm:pb-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-5">
        購物車
        <span className="ml-2 text-base font-normal text-gray-400">（{items.reduce((s, i) => s + i.quantity, 0)} 件）</span>
      </h1>

      <div className="space-y-3 mb-6">
        {items.map(item => (
          <div key={item.variant_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex gap-4 items-start">
              {/* Image */}
              <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 relative">
                {item.cover_image_url ? (
                  <Image src={item.cover_image_url} alt={item.product_name} fill className="object-cover" sizes="80px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">💊</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/products/${item.product_slug}`} className="font-bold text-gray-800 hover:text-green-700 text-base leading-snug block line-clamp-2">
                      {item.product_name}
                    </Link>
                    <p className="text-gray-500 text-sm mt-1 font-medium">{item.variant_name}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.variant_id)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-lg"
                    aria-label="移除"
                  >✕</button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  {/* Qty controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.variant_id, item.quantity - 1)}
                      className="w-9 h-9 rounded-xl border-2 border-gray-200 hover:border-green-500 font-bold text-lg flex items-center justify-center transition-colors"
                    >−</button>
                    <span className="w-9 text-center font-bold text-lg">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.variant_id, item.quantity + 1)}
                      className="w-9 h-9 rounded-xl border-2 border-gray-200 hover:border-green-500 font-bold text-lg flex items-center justify-center transition-colors"
                    >+</button>
                  </div>

                  {/* Subtotal */}
                  <div className="text-right">
                    <div className="font-bold text-gray-800 text-lg">{formatPrice(item.unit_price * item.quantity)}</div>
                    {item.quantity > 1 && (
                      <div className="text-gray-400 text-xs">{formatPrice(item.unit_price)} × {item.quantity}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-gray-500 text-sm">
            <span>商品小計</span>
            <span>{formatPrice(totalAmount)}</span>
          </div>
          <div className="flex justify-between text-gray-500 text-sm">
            <span>取貨方式</span>
            <span>7-11 門市取貨</span>
          </div>
          <div className="flex justify-between text-gray-500 text-sm">
            <span>付款方式</span>
            <span className="text-green-700 font-bold">取貨付款</span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
          <span className="text-xl font-bold text-gray-800">合計金額</span>
          <span className="text-2xl font-bold text-green-700">{formatPrice(totalAmount)}</span>
        </div>
      </div>

      {/* Quick info card */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xl mb-0.5">🏪</div>
            <p className="text-xs font-bold text-green-800">取貨時付款</p>
            <p className="text-[11px] text-green-600 mt-0.5">不預先扣款</p>
          </div>
          <div>
            <div className="text-xl mb-0.5">📦</div>
            <p className="text-xs font-bold text-green-800">約 3 工作日</p>
            <p className="text-[11px] text-green-600 mt-0.5">送達 7-11</p>
          </div>
          <div>
            <div className="text-xl mb-0.5">💬</div>
            <p className="text-xs font-bold text-green-800">LINE 通知</p>
            <p className="text-[11px] text-green-600 mt-0.5">到店即時提醒</p>
          </div>
        </div>
      </div>

      {/* Desktop checkout button */}
      <div className="hidden sm:block">
        <Link href="/checkout" className="btn-primary w-full block text-center text-xl py-4">
          前往結帳 →
        </Link>
        <Link href="/" className="block text-center text-green-700 font-semibold mt-3 py-2 hover:underline text-base">
          ← 繼續購物
        </Link>
      </div>

      {/* Mobile sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 p-4 sm:hidden z-30 shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-600 font-medium">合計金額</span>
          <span className="text-xl font-bold text-green-700">{formatPrice(totalAmount)}</span>
        </div>
        <Link href="/checkout" className="btn-primary w-full block text-center text-xl py-4">
          前往結帳 →
        </Link>
      </div>
    </div>
  )
}
