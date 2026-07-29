'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { CartItem } from '@/lib/types'
import toast from 'react-hot-toast'
import { trackFunnel } from '@/lib/funnel'

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (variantId: number) => void
  updateQty: (variantId: number, qty: number) => void
  clearCart: () => void
  totalItems: number
  totalAmount: number
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  useEffect(() => { try { const s = localStorage.getItem('cart_items'); if (s) setItems(JSON.parse(s)) } catch {} }, [])
  useEffect(() => { localStorage.setItem('cart_items', JSON.stringify(items)) }, [items])

  const addItem = (newItem: CartItem) => {
    // 漏斗埋點：加入購物車（意圖）
    trackFunnel('add_to_cart', { product_id: newItem.product_id, variant_id: newItem.variant_id, quantity: newItem.quantity })
    setItems(prev => {
      const existing = prev.find(i => i.variant_id === newItem.variant_id)
      if (existing) {
        const newQty = Math.min(existing.quantity + newItem.quantity, existing.stock_qty)
        if (newQty === existing.quantity) { toast.error('⚠️ 已達庫存上限'); return prev }
        toast.success('✅ 已加入購物車！')
        return prev.map(i => i.variant_id === newItem.variant_id ? { ...i, quantity: newQty } : i)
      }
      toast.success('✅ 已加入購物車！')
      return [...prev, newItem]
    })
  }

  const removeItem = (variantId: number) => setItems(prev => prev.filter(i => i.variant_id !== variantId))
  const updateQty = (variantId: number, qty: number) => setItems(prev => prev.map(i => i.variant_id !== variantId ? i : { ...i, quantity: Math.min(Math.max(1, qty), i.stock_qty) }))
  const clearCart = () => { setItems([]); localStorage.removeItem('cart_items') }
  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const totalAmount = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  return <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalAmount }}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
