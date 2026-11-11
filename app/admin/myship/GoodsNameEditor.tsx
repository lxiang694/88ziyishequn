'use client'

/**
 * 商品明細超過 200 字的訂單：直接在品名後面改短。
 *
 * 賣貨便的「商品明細」欄最多 200 字，內容是每件商品的「SKU 品名（規格）×數量」。
 * 一張訂單買十幾樣、或品名裡夾著長長的說明（例如「(需發冷鏈 請洽詢LINE購買)」），
 * 就會超過。這裡每個品名都是輸入框，上面即時算字數，改到 200 字內就能存。
 *
 * 只改這張訂單的品名，不動商城商品資料；規格、數量、金額都不改。
 */
import { useState } from 'react'
import { goodsLength, stripNote, GOODS_MAX, ITEM_NAME_MAX } from '@/lib/myship/domain'

export type EditableItem = { id: number; name: string; variant: string; sku: string | null; quantity: number }

export default function GoodsNameEditor({ items, busy, onSave }: {
  items: EditableItem[]
  busy: boolean
  onSave: (changes: { id: number; name: string }[]) => void
}) {
  const [names, setNames] = useState<Record<number, string>>(() => Object.fromEntries(items.map(i => [i.id, i.name])))
  const current = items.map(i => ({
    sku_snapshot: i.sku, product_name_snapshot: (names[i.id] ?? i.name).trim(),
    variant_name_snapshot: i.variant, quantity: i.quantity,
  }))
  const length = goodsLength(current)
  const over = length - GOODS_MAX
  const changes = items.map(i => ({ id: i.id, name: (names[i.id] ?? i.name).trim().replace(/\s+/g, ' ') }))
    .filter((c, n) => c.name !== items[n].name)
  const blank = changes.some(c => !c.name)
  const hasNotes = items.some(i => stripNote(names[i.id] ?? i.name) !== (names[i.id] ?? i.name))

  return (
    <div className="text-sm">
      <div className={`mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 font-semibold ${over > 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
        <span className="tabular-nums">商品明細 {length} / {GOODS_MAX} 字</span>
        <span>{over > 0 ? `還要少 ${over} 字` : '✓ 已在 200 字內，可以儲存'}</span>
        {hasNotes && (
          <button type="button" disabled={busy}
            onClick={() => setNames(prev => Object.fromEntries(items.map(i => [i.id, stripNote(prev[i.id] ?? i.name)])))}
            className="ml-auto rounded-md border border-current bg-white px-2 py-1 text-xs font-bold disabled:opacity-40">
            一鍵去掉品名後面的括號說明
          </button>
        )}
      </div>
      <ul className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5">
        {items.map(i => {
          const value = names[i.id] ?? i.name
          const changed = value.trim() !== i.name
          return (
            <li key={i.id} className="contents">
              <span className="text-slate-400">{i.sku}</span>
              <input value={value} maxLength={ITEM_NAME_MAX} disabled={busy} aria-label={`${i.sku || ''} 品名`}
                onChange={e => setNames(prev => ({ ...prev, [i.id]: e.target.value }))}
                className={`w-full min-w-0 rounded-md border px-2 py-1 ${changed ? 'border-green-600 bg-green-50' : 'border-slate-300'}`} />
              <span className="whitespace-nowrap text-slate-500">· {i.variant} ×{i.quantity}</span>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !changes.length || over > 0 || blank} onClick={() => onSave(changes)}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          儲存品名（{changes.length} 項）
        </button>
        {changes.length > 0 && (
          <button type="button" disabled={busy} onClick={() => setNames(Object.fromEntries(items.map(i => [i.id, i.name])))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">還原</button>
        )}
        <span className="text-xs text-slate-500">只改這張訂單的品名，不會改到商城商品</span>
      </div>
    </div>
  )
}
