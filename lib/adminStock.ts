/**
 * 後台庫存提醒 —— 純函式。
 *
 * 「庫存不足」看每一個啟用中的規格，不看加總：三種規格加起來 30 件，
 * 其中一種只剩 2 件，那一種還是快賣完了，要提醒補貨。
 * 停用（下架）的規格前台不賣，不算。
 */
export const LOW_STOCK = 5   // 少於 5 件（1～4）就提醒；0 件是售完

export type StockLevel = 'out' | 'low' | 'ok'

export function stockLevel(qty: number): StockLevel {
  const n = Number(qty) || 0
  return n <= 0 ? 'out' : n < LOW_STOCK ? 'low' : 'ok'
}

interface V { variant_name?: string; stock_qty: number; is_active: boolean }

/** 這件商品需要補貨的規格（售完的排前面） */
export function stockAlerts(variants: V[] | null | undefined): { name: string; qty: number; level: 'out' | 'low' }[] {
  return (variants || [])
    .filter(v => v.is_active)
    .map(v => ({ name: v.variant_name || '', qty: Number(v.stock_qty) || 0, level: stockLevel(v.stock_qty) }))
    .filter((a): a is { name: string; qty: number; level: 'out' | 'low' } => a.level !== 'ok')
    .sort((a, b) => a.qty - b.qty)
}

export function needsRestock(variants: V[] | null | undefined): boolean {
  return stockAlerts(variants).length > 0
}
