'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { csvCell, csvDigits, formatTwDateTime, isStorePickup, ORDER_STATUSES, SHIPPING_LABEL, SHIPPING_METHODS, SHIPPING_SHORT, supplierSummary, type ShippingMethod } from '@/lib/groupBuy/domain'

type OrderItem = { item_id: number; name_snapshot: string; spec_snapshot: string; unit_price: number; quantity: number; subtotal: number }
type Order = {
  id: number; order_no: string; customer_name: string; phone: string; shipping_method: ShippingMethod
  store_code: string | null; store_name: string | null; store_address: string | null
  home_address: string | null; delivery_time: string | null; note: string
  subtotal: number; shipping_fee: number; total_amount: number; status: string; admin_note: string; created_at: string
  items: OrderItem[]
}

const STATUS_STYLE: Record<string, string> = {
  待出貨: 'bg-amber-100 text-amber-800', 已出貨: 'bg-blue-100 text-blue-800', 已完成: 'bg-green-100 text-green-800', 已取消: 'bg-gray-200 text-gray-600',
}
const money = (n: number) => `$${n.toLocaleString('zh-TW')}`

function download(name: string, rows: string[][]) {
  // 開頭加 BOM，Excel 打開中文才不會變亂碼
  const blob = new Blob(['﻿' + rows.map(r => r.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function GroupBuyOrdersPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<{ slug: string; title: string; starts_at: string; ends_at: string } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await (await fetch(`/api/admin/group-buy/${params.id}/orders`, { cache: 'no-store' })).json()
    if (d.success) { setCampaign(d.data.campaign); setOrders(d.data.orders) } else toast.error(d.error || '讀取失敗')
    setLoading(false)
    setSelected([])
  }, [params.id])
  useEffect(() => { load() }, [load])

  const summary = useMemo(() => supplierSummary(orders), [orders])
  const shown = orders.filter(o =>
    (!status || o.status === status) && (!method || o.shipping_method === method) &&
    (!q || [o.order_no, o.customer_name, o.phone].some(v => v.includes(q.trim()))))

  const updateStatus = async (ids: number[], next: string) => {
    if (!ids.length) return
    if (next === '已取消' && !confirm(`確定取消 ${ids.length} 筆訂單？取消後限量名額會釋出。`)) return
    setBusy(true)
    const d = await (await fetch(`/api/admin/group-buy/orders/${ids[0]}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, status: next }),
    })).json()
    setBusy(false)
    if (!d.success) return toast.error(d.error || '更新失敗')
    toast.success(`已更新 ${d.updated} 筆`)
    load()
  }

  const exportOrders = () => {
    const rows = [['訂單編號', '下單時間', '狀態', '收件人', '手機', '取貨方式', '門市店號', '門市名稱', '門市地址', '宅配地址', '送達時段', '商品', '商品金額', '運費', '應收金額', '客人備註', '內部備註']]
    for (const o of shown) rows.push([
      csvCell(o.order_no), csvCell(formatTwDateTime(o.created_at)), csvCell(o.status), csvCell(o.customer_name), csvDigits(o.phone),
      csvCell(SHIPPING_LABEL[o.shipping_method]), csvDigits(o.store_code), csvCell(o.store_name), csvCell(o.store_address),
      csvCell(o.home_address), csvCell(o.delivery_time),
      csvCell(o.items.map(i => `${i.name_snapshot}${i.spec_snapshot ? `（${i.spec_snapshot}）` : ''}×${i.quantity}`).join('；')),
      String(o.subtotal), String(o.shipping_fee), String(o.total_amount), csvCell(o.note), csvCell(o.admin_note),
    ])
    download(`團購訂單_${campaign?.slug}.csv`, rows)
  }
  const exportSummary = () => {
    const rows = [['商品', '規格', '總數量', ...SHIPPING_METHODS.map(m => SHIPPING_SHORT[m]), '商品金額']]
    for (const r of summary.items) rows.push([csvCell(r.name), csvCell(r.spec), String(r.quantity), ...SHIPPING_METHODS.map(m => String(r.byMethod[m])), String(r.amount)])
    download(`叫貨匯總_${campaign?.slug}.csv`, rows)
  }
  const copySummary = async () => {
    const text = [`${campaign?.title} 叫貨數量`, ...summary.items.map(r => `${r.name}${r.spec ? `（${r.spec}）` : ''}：${r.quantity}`), `共 ${summary.orderCount} 筆訂單`].join('\n')
    try { await navigator.clipboard.writeText(text); toast.success('已複製，可以直接貼給品牌方') } catch { toast.error('複製失敗') }
  }

  if (loading && !campaign) return <p className="card p-8 text-center text-gray-500">載入中…</p>
  const allShownSelected = shown.length > 0 && shown.every(o => selected.includes(o.id))

  return (
    <div className="max-w-5xl">
      <Link href="/admin/group-buy" className="text-sm font-bold text-green-700">← 團購管理</Link>
      <h1 className="mt-2 text-xl font-bold text-gray-800 sm:text-2xl">{campaign?.title}・訂單</h1>
      {campaign && <p className="mt-0.5 text-sm text-gray-600">{formatTwDateTime(campaign.starts_at)} 開團 ～ {formatTwDateTime(campaign.ends_at)} 截單</p>}

      {/* ── 叫貨匯總 ─────────────────────────────── */}
      <section className="card mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">叫貨匯總 <span className="text-sm font-normal text-gray-500">（不含已取消）</span></h2>
          <div className="flex gap-2">
            <button onClick={copySummary} className="rounded-lg border px-3 py-2 text-sm font-semibold">複製文字給品牌方</button>
            <button onClick={exportSummary} className="rounded-lg border px-3 py-2 text-sm font-semibold">匯出 CSV</button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-600">共 <b>{summary.orderCount}</b> 筆訂單・應收合計 <b>{money(summary.revenue)}</b></p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-600 [&>th]:whitespace-nowrap"><th className="py-2">商品</th><th className="py-2 pl-3 text-right">數量</th>{SHIPPING_METHODS.map(m => <th key={m} className="py-2 pl-3 text-right">{SHIPPING_SHORT[m]}</th>)}<th className="hidden py-2 pl-3 text-right sm:table-cell">金額</th></tr></thead>
            <tbody>
              {summary.items.map(r => (
                <tr key={r.item_id} className="border-b last:border-0">
                  <td className="py-2 font-semibold">{r.name}{r.spec && <span className="ml-1 font-normal text-gray-500">{r.spec}</span>}</td>
                  <td className="py-2 pl-3 text-right text-lg font-bold">{r.quantity}</td>
                  {SHIPPING_METHODS.map(m => <td key={m} className="py-2 pl-3 text-right">{r.byMethod[m] || <span className="text-gray-300">0</span>}</td>)}
                  <td className="hidden whitespace-nowrap py-2 pl-3 text-right sm:table-cell">{money(r.amount)}</td>
                </tr>
              ))}
              {!summary.items.length && <tr><td colSpan={6} className="py-6 text-center text-gray-500">還沒有訂單</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 篩選與批次 ───────────────────────────── */}
      <section className="card mt-4 space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_11rem]">
          <input className="rounded-lg border px-3 py-2" placeholder="搜尋訂單編號、姓名、手機" value={q} onChange={e => setQ(e.target.value)} />
          <select className="rounded-lg border px-3 py-2" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">全部狀態</option>{ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="">全部取貨方式</option>{SHIPPING_METHODS.map(m => <option key={m} value={m}>{SHIPPING_SHORT[m]}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-green-700" checked={allShownSelected}
              onChange={() => setSelected(allShownSelected ? [] : shown.map(o => o.id))} />
            {selected.length ? `已選 ${selected.length} 筆` : `全選（${shown.length} 筆）`}
          </label>
          {selected.length > 0 && ORDER_STATUSES.map(s => (
            <button key={s} disabled={busy} onClick={() => updateStatus(selected, s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${STATUS_STYLE[s]}`}>改成{s}</button>
          ))}
          <button onClick={exportOrders} className="ml-auto rounded-lg border px-3 py-2 text-sm font-semibold">匯出訂單 CSV（{shown.length}）</button>
        </div>
      </section>

      {/* ── 訂單 ───────────────────────────────── */}
      <section className="mt-4 space-y-2">
        {shown.map(o => (
          <div key={o.id} className={`card flex gap-3 p-4 ${o.status === '已取消' ? 'opacity-60' : ''}`}>
            <input type="checkbox" className="mt-1 h-5 w-5 flex-shrink-0 accent-green-700" checked={selected.includes(o.id)}
              onChange={() => setSelected(s => s.includes(o.id) ? s.filter(x => x !== o.id) : [...s, o.id])} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold">{o.order_no}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                <span className="text-xs text-gray-500">{formatTwDateTime(o.created_at)}</span>
              </div>
              <p className="mt-1 text-[15px]"><b>{o.customer_name}</b> · <span className="font-mono">{o.phone}</span></p>
              <p className="mt-0.5 text-sm text-gray-700">
                {isStorePickup(o.shipping_method)
                  ? <>🏪 {SHIPPING_SHORT[o.shipping_method]}・{o.store_name}門市（{o.store_code}）<span className="text-gray-500"> {o.store_address}</span></>
                  : <>🚚 黑貓宅配：{o.home_address}<span className="text-gray-500">（{o.delivery_time}）</span></>}
              </p>
              <p className="mt-1 text-sm text-gray-600">{o.items.map(i => `${i.name_snapshot}${i.spec_snapshot ? `（${i.spec_snapshot}）` : ''} ×${i.quantity}`).join('、')}</p>
              {o.note && <p className="mt-1 text-sm text-amber-800">客人備註：{o.note}</p>}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <span className="text-lg font-bold text-red-600">{money(o.total_amount)}</span>
              <select className="rounded-lg border px-2 py-1 text-sm" value={o.status} disabled={busy} onChange={e => updateStatus([o.id], e.target.value)}>
                {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
        {!shown.length && <p className="card p-8 text-center text-gray-500">沒有符合條件的訂單</p>}
      </section>
    </div>
  )
}
