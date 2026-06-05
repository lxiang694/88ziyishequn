'use client'
import { useState } from 'react'
import { useCart } from './CartContext'
import VariantPicker from './VariantPicker'

interface Variant {
  id: number
  variant_name: string
  sale_price: number
  original_price: number | null
  stock_qty: number
  sku_code: string | null
  is_active: boolean
}

interface Product {
  id: number
  product_name: string
  slug: string
  short_intro: string | null
  cover_image_url: string | null
  product_variants: Variant[]
}

export default function QuizResultCart({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [pickerOpen, setPickerOpen] = useState(false)

  const activeVariants = product.product_variants.filter(v => v.is_active && v.stock_qty > 0)
  const inStock = activeVariants.length > 0

  const handleAdd = () => {
    if (!inStock) return
    if (activeVariants.length === 1) {
      const v = activeVariants[0]
      addItem({
        product_id: product.id,
        product_name: product.product_name,
        product_slug: product.slug,
        cover_image_url: product.cover_image_url,
        variant_id: v.id,
        variant_name: v.variant_name,
        sku_code: v.sku_code,
        unit_price: v.sale_price,
        quantity: 1,
        stock_qty: v.stock_qty,
      })
    } else {
      setPickerOpen(true)
    }
  }

  return (
    <>
      <button
        onClick={handleAdd}
        disabled={!inStock}
        className={`w-full font-bold py-2.5 rounded-xl text-sm transition-colors
          ${inStock
            ? 'bg-green-700 hover:bg-green-800 text-white'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        {!inStock ? '已售完' : activeVariants.length > 1 ? '選擇規格' : '加入購物車'}
      </button>

      {pickerOpen && (
        <VariantPicker
          product={{ ...product, product_slug: product.slug }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
