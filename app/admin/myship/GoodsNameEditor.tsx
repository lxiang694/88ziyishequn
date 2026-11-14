'use client'

/**
 * 商品明細超過 200 字的訂單：直接把品名、規格改短。
 *
 * 賣貨便的「商品明細」欄最多 200 字，內容是每件商品的「SKU 品名（規格）×數量」。
 * 一張訂單買十幾樣、或品名／規格裡夾著說明（「(需發冷鏈 請洽詢LINE購買)」
 * 「（推荐女生用）」），就會超過。
 *
 * 版面為手機設計（常在手機上處理）：
 *   • 一樣商品一張小卡，品名、規格各一個整行寬的輸入框（以前輸入框在手機上被擠到看不見）
 *   • 每樣顯示佔幾個字，最長的幾樣標橘色 —— 先改最長的最快
 *   • 一鍵精簡：去掉括號裡的說明文字（保留有數字的括號），規格開頭重複的品名也拿掉
 *   • 最下面直接顯示「會送到賣貨便的商品明細」全文
 *
 * 只改這張訂單的品名／規格快照，不動商城商品資料；數量、金額都不改。
 */
import { useState } from 'react'
import { goodsLength, goodsText, simplifyItem, GOODS_MAX, ITEM_NAME_MAX } from '@/lib/myship/domain'

export type EditableItem = { id: number; name: string; variant: string; sku: string | null; quantity: number }
type Draft = { name: string; variant: string }

const tidy = (s: string) => s.trim().replace(/\s+/g, ' ')
const len = (s: string) => Array.from(s).length

export default function GoodsNameEditor({ items, busy, onSave }: {
  items: EditableItem[]
  busy: boolean
  onSave: (changes: { id: number; name: string; variant: string }[]) => void
}) {
  const original = () => Object.fromEntries(items.map(i => [i.id, { name: i.name, variant: i.variant }])) as Record<number, Draft>
  const [draft, setDraft] = useState<Record<number, Draft>>(original)
  const rows = items.map(i => ({ ...i, d: draft[i.id] ?? { name: i.name, variant: i.variant } }))
  const asGoods = rows.map(r => ({ sku_snapshot: r.sku, product_name_snapshot: tidy(r.d.name), variant_name_snapshot: tidy(r.d.variant), quantity: r.quantity }))
  const length = goodsLength(asGoods)
  const over = length - GOODS_MAX
  const lineLen = (r: typeof rows[number]) => len(goodsText([asGoods[rows.indexOf(r)]])) + 1   // ＋1 是分隔的「；」
  // 最長的三樣標出來（超過時才標）
  const longest = over > 0 ? new Set([...rows].sort((a, b) => lineLen(b) - lineLen(a)).slice(0, 3).map(r => r.id)) : new Set<number>()

  const changes = rows
    .map(r => ({ id: r.id, name: tidy(r.d.name), variant: tidy(r.d.variant) }))
    .filter((c, n) => c.name !== items[n].name || c.variant !== items[n].variant)
  const blank = rows.some(r => !tidy(r.d.name) || !tidy(r.d.variant))
  const canTrim = rows.some(r => { const x = simplifyItem(r.d.name, r.d.variant); return x.name !== r.d.name || x.variant !== r.d.variant })
  const set = (id: number, key: keyof Draft, v: string) => setDraft(p => ({ ...p, [id]: { ...(p[id] ?? { name: '', variant: '' }), [key]: v } }))

  return (
    <div className="text-sm">
      {/* 字數：捲動時黏在上面，改到哪裡都看得到還差多少 */}
      <div className={`sticky top-0 z-10 mb-3 rounded-xl px-3 py-2.5 ${over > 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
        <p className="text-[15px] font-bold tabular-nums">
          商品明細 {length} / {GOODS_MAX} 字・{over > 0 ? `還要少 ${over} 字` : '✓ 已在 200 字內，可以儲存'}
        </p>
        {canTrim && (
          <button type="button" disabled={busy}
            onClick={() => setDraft(p => Object.fromEntries(rows.map(r => [r.id, simplifyItem(p[r.id]?.name ?? r.name, p[r.id]?.variant ?? r.variant)])))}
            className="mt-2 w-full rounded-lg border-2 border-current bg-white px-3 py-2 text-[14px] font-bold disabled:opacity-40 sm:w-auto">
            ✂️ 一鍵精簡：去掉括號說明、規格裡重複的品名
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map(r => {
          const nameChanged = tidy(r.d.name) !== r.name
          const variantChanged = tidy(r.d.variant) !== r.variant
          const hot = longest.has(r.id)
          return (
            <li key={r.id} className={`rounded-xl border-2 p-2.5 ${hot ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-semibold text-slate-500">{r.sku || '無編號'}・數量 ×{r.quantity}</span>
                <span className={`tabular-nums ${hot ? 'font-bold text-amber-700' : 'text-slate-400'}`}>{hot && '最長・'}{lineLen(r)} 字</span>
              </div>
              <label className="flex items-center gap-2">
                <span className="w-8 flex-shrink-0 text-[13px] text-slate-500">品名</span>
                <input value={r.d.name} maxLength={ITEM_NAME_MAX} disabled={busy} onChange={e => set(r.id, 'name', e.target.value)}
                  className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-base ${nameChanged ? 'border-green-600 bg-green-50' : 'border-slate-300'}`} />
              </label>
              <label className="mt-1.5 flex items-center gap-2">
                <span className="w-8 flex-shrink-0 text-[13px] text-slate-500">規格</span>
                <input value={r.d.variant} maxLength={ITEM_NAME_MAX} disabled={busy} onChange={e => set(r.id, 'variant', e.target.value)}
                  className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-base ${variantChanged ? 'border-green-600 bg-green-50' : 'border-slate-300'}`} />
              </label>
            </li>
          )
        })}
      </ul>

      {/* 實際會送到賣貨便的文字 */}
      <details className="mt-3 rounded-xl bg-slate-50 p-3">
        <summary className="cursor-pointer text-[13px] font-bold text-slate-600">看會送到賣貨便的商品明細</summary>
        <p className="mt-2 break-all text-[13px] leading-relaxed text-slate-700">{goodsText(asGoods)}</p>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !changes.length || over > 0 || blank} onClick={() => onSave(changes)}
          className="min-h-[44px] flex-1 rounded-xl bg-green-700 px-5 text-[15px] font-bold text-white disabled:opacity-40 sm:flex-none">
          {over > 0 ? `還要少 ${over} 字才能儲存` : `儲存修改（${changes.length} 項）`}
        </button>
        {changes.length > 0 && (
          <button type="button" disabled={busy} onClick={() => setDraft(original())}
            className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm disabled:opacity-40">還原</button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">只改這張訂單的品名、規格文字，不會改到商城商品；數量、金額不變</p>
    </div>
  )
}
