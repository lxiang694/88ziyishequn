'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useCart } from './CartContext'
import { formatPrice } from '@/lib/utils'

interface Variant {
  id: number
  variant_name: string
  sale_price: number
  original_price: number | null
  stock_qty: number
  sku_code: string | null
  is_active: boolean
}

interface Props {
  product: {
    id: number
    product_name: string
    product_slug: string
    cover_image_url: string | null
    short_intro: string | null
    product_variants: Variant[]
  } | null
  onClose: () => void
  onAdded?: () => void
}

export default function VariantPicker({ product, onClose, onAdded }: Props) {
  const { addItem } = useCart()
  const [selected, setSelected] = useState<Variant | null>(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (product) {
      const firstAvailable = product.product_variants.find(v => v.is_active && v.stock_qty > 0)
      setSelected(firstAvailable || null)
      setQty(1)
    }
  }, [product])

  if (!product) return null

  const activeVariants = product.product_variants.filter(v => v.is_active)

  const handleAdd = () => {
    if (!selected) return
    addItem({
      product_id: product.id,
      product_name: product.product_name,
      product_slug: product.product_slug,
      cover_image_url: product.cover_image_url,
      variant_id: selected.id,
      variant_name: selected.variant_name,
      sku_code: selected.sku_code,
      unit_price: selected.sale_price,
      quantity: qty,
      stock_qty: selected.stock_qty,
    })
    onAdded?.()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer - slides up from bottom on mobile, centered modal on desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl
                      md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                      md:max-w-lg md:w-full md:rounded-2xl animate-slide-up">

        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 px-5 pt-4 pb-4 border-b border-gray-100">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 relative flex-shrink-0">
            {product.cover_image_url ? (
              <Image src={product.cover_image_url} alt={product.product_name} fill className="object-cover" sizes="80px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">💊</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-snug">{product.product_name}</h3>
            {product.short_intro && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{product.short_intro}</p>
            )}
            {selected && (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-green-700">{formatPrice(selected.sale_price)}</span>
                {selected.original_price && selected.original_price > selected.sale_price && (
                  <span className="text-gray-400 line-through text-sm">{formatPrice(selected.original_price)}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xl"
          >✕</button>
        </div>

        {/* Variants */}
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-gray-600 mb-3">選擇規格</p>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {activeVariants.map(v => {
              const outOfStock = v.stock_qty <= 0
              const isSelected = selected?.id === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => { if (!outOfStock) { setSelected(v); setQty(1) } }}
                  disabled={outOfStock}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left
                    ${isSelected
                      ? 'border-green-600 bg-green-50'
                      : outOfStock
                      ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                      : 'border-gray-200 hover:border-green-400 hover:bg-green-50/50'}`}
                >
                  <div>
                    <span className={`font-semibold text-base ${isSelected ? 'text-green-800' : outOfStock ? 'text-gray-400' : 'text-gray-800'}`}>
                      {v.variant_name}
                      {outOfStock && <span className="ml-2 text-xs font-normal text-red-400">（已售完）</span>}
                    </span>
                    {v.sku_code && <span className="block text-xs text-gray-400 mt-0.5">SKU: {v.sku_code}</span>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className={`font-bold text-base ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                      {formatPrice(v.sale_price)}
                    </div>
                    {v.original_price && v.original_price > v.sale_price && (
                      <div className="text-gray-400 line-through text-xs">{formatPrice(v.original_price)}</div>
                    )}
                    {!outOfStock && (
                      <div className="text-gray-400 text-xs mt-0.5">庫存 {v.stock_qty}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quantity + Add to cart */}
        <div className="px-5 pb-6 pt-2 border-t border-gray-100">
          {selected && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-600">購買數量</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 hover:border-green-500 font-bold text-xl flex items-center justify-center transition-colors"
                >−</button>
                <span className="w-10 text-center font-bold text-xl">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(selected.stock_qty, q + 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 hover:border-green-500 font-bold text-xl flex items-center justify-center transition-colors"
                >+</button>
              </div>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={!selected || selected.stock_qty <= 0}
            className="w-full btn-primary text-xl py-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!selected ? '請選擇規格' : selected.stock_qty <= 0 ? '已售完' : `加入購物車`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
        @media (min-width: 768px) {
          .animate-slide-up {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
