'use client'
import { useState } from 'react'
import { useCart } from './CartContext'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

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
    slug: string
    cover_image_url: string | null
    product_variants: Variant[]
  }
  shipMonth: string
  /** true = 固定在畫面底部的行動版購買列 */
  sticky?: boolean
}

/**
 * 預售購買區。
 *
 * 走的是站上既有的購物車與結帳流程 —— 預售在使用者眼中就是一般下單，
 * 差別只在出貨時間。刻意不另做一套預售訂單系統，
 * 否則庫存扣減、訂單管理、會員訂單列表全部要再實作一次。
 */
export default function PresaleBuyBox({ product, shipMonth, sticky = false }: Props) {
  const { addItem } = useCart()
  const variants = product.product_variants.filter(v => v.is_active)
  const [selectedId, setSelectedId] = useState<number>(
    variants.find(v => v.stock_qty > 0)?.id ?? variants[0]?.id ?? 0)
  const [qty, setQty] = useState(1)

  const selected = variants.find(v => v.id === selectedId) || null
  const soldOut = !selected || selected.stock_qty <= 0
  const max = selected ? Math.min(selected.stock_qty, 10) : 1

  const add = () => {
    if (!selected || soldOut) return
    addItem({
      product_id: product.id,
      product_name: product.product_name,
      product_slug: product.slug,
      cover_image_url: product.cover_image_url,
      variant_id: selected.id,
      variant_name: selected.variant_name,
      sku_code: selected.sku_code,
      unit_price: selected.sale_price,
      quantity: qty,
      stock_qty: selected.stock_qty,
    })
    toast.success('已加入購物車')
  }

  if (sticky) {
    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-gray-500 leading-tight">預計 {shipMonth} 出貨</p>
            <p className="font-bold text-gray-900 text-lg leading-tight">
              {selected ? formatPrice(selected.sale_price) : '—'}
            </p>
          </div>
          <button onClick={add} disabled={soldOut}
            className="flex-1 min-h-[48px] rounded-xl bg-green-700 text-white font-bold disabled:bg-gray-300 disabled:text-gray-500">
            {soldOut ? '本批已售完' : '立即預購'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-green-600 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-green-700 text-white text-[13px] font-bold px-3 py-1 rounded-full">預售中</span>
        <span className="text-[13px] text-gray-600">預計 {shipMonth} 出貨</span>
      </div>

      {variants.length > 1 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {variants.map(v => (
            <button key={v.id} onClick={() => { setSelectedId(v.id); setQty(1) }}
              disabled={v.stock_qty <= 0}
              className={`min-h-[48px] rounded-xl border-2 px-3 font-semibold text-[15px] transition-colors ${
                v.id === selectedId
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-700'
              } disabled:opacity-40 disabled:line-through`}>
              {v.variant_name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 mb-1">
        <span className="text-4xl font-bold text-gray-900">
          {selected ? formatPrice(selected.sale_price) : '—'}
        </span>
        {selected?.original_price && selected.original_price > selected.sale_price && (
          <span className="text-gray-400 line-through text-lg mb-1">
            {formatPrice(selected.original_price)}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-5">
        {selected?.variant_name}
        {selected && selected.stock_qty > 0 && selected.stock_qty <= 30 && (
          <span className="text-amber-700 font-semibold"> · 本批剩 {selected.stock_qty} 瓶</span>
        )}
      </p>

      {!soldOut && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gray-700 font-semibold text-[15px]">數量</span>
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-12 h-12 text-xl font-bold text-gray-600 hover:bg-gray-50">−</button>
            <span className="w-12 text-center font-bold text-gray-900">{qty}</span>
            <button onClick={() => setQty(q => Math.min(max, q + 1))}
              className="w-12 h-12 text-xl font-bold text-gray-600 hover:bg-gray-50">＋</button>
          </div>
        </div>
      )}

      <button onClick={add} disabled={soldOut}
        className="w-full min-h-[52px] rounded-2xl bg-green-700 hover:bg-green-800 text-white font-bold text-lg transition-colors disabled:bg-gray-300 disabled:text-gray-500">
        {soldOut ? '本批已售完' : '立即預購'}
      </button>

      <p className="text-[13px] text-gray-500 leading-relaxed mt-3">
        結帳後即完成預訂，出貨前會再通知您一次。
        若因天候延後，我們會主動告知新時程，您可以選擇繼續等或全額退款。
      </p>
    </div>
  )
}
