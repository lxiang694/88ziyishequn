'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Marketplace, Mapping, PreparedOrder } from '@/lib/myship/domain'
import AssistantPanel from './AssistantPanel'
import BatchHistory from './BatchHistory'

type Item = { variant_id: number | null; name: string; variant: string; sku: string | null }
type StoreFix = { id: number; store_name: string; address: string } | null
type Row = PreparedOrder & { store_fix?: StoreFix; customer_name: string; total_amount: number; order_total: number; store_name: string; reserved: boolean; items: Item[] }
type Transfer = { id: string; order_id: number | null; group_buy_order_id?: number | null; source?: string; marketplace_id: string; batch_id: string; status: string; external_order_no: string | null; created_at: string; import_row: string[] }
type GbRow = {
  id: number; order_no: string; campaign_id: number; campaign_title: string; customer_name: string
  shipping_method: string; temperature: '冷凍' | '常溫' | null; store_name: string | null
  total_amount: number; shipping_fee: number; created_at: string
  items: { name: string; spec: string; quantity: number }[]; errors: string[]; reserved: boolean; store_fix?: StoreFix
}
type Data = { orders: Row[]; groupBuyOrders?: GbRow[]; groupBuyReady?: boolean; markets: Marketplace[]; mappings: Mapping[]; transfers: Transfer[] }
const money = (n: number) => `NT$${n.toLocaleString('zh-TW')}`
const button = 'rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-slate-700'
const outline = 'rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40'

async function post(path: string, body: unknown) {
  const response = await fetch('/api/admin/myship/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '操作失敗')
  return result
}

export default function MyshipPage() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // 不寫死賣場代碼 —— 載入後選第一個已啟用的賣場。
  // 寫死的話，那個賣場一旦停用或改代碼，整頁就會停在一個選不到訂單的狀態。
  const [market, setMarket] = useState('')
  const [tab, setTab] = useState<'orders' | 'mapping' | 'history'>('orders')
  const [selected, setSelected] = useState<number[]>([])
  // 一般訂單／團購訂單分開選、分開匯出（一批只放同一種）
  const [view, setView] = useState<'shop' | 'group_buy'>('shop')
  const [selectedGb, setSelectedGb] = useState<number[]>([])
  const [confirming, setConfirming] = useState<Transfer | null>(null)
  const [external, setExternal] = useState('')
  const [verified, setVerified] = useState(false)
  const [notCreated, setNotCreated] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/myship', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '讀取失敗')
    setData(result)
    setSelected([])
    setSelectedGb([])
    // 目前選的賣場若不在（或已停用），退回第一個已啟用的
    setMarket(current => {
      const markets: Marketplace[] = result.markets || []
      if (markets.some(m => m.id === current && m.enabled)) return current
      return markets.find(m => m.enabled)?.id || ''
    })
  }, [])
  useEffect(() => { load().catch(e => setError(e.message)) }, [load])
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : '操作失敗') } finally { setBusy(false) }
  }
  // 門市被標成停用、但其實還在營業：確認後一鍵重新啟用
  const activateStore = (fix: NonNullable<StoreFix>) => {
    if (!confirm(`重新啟用門市「${fix.store_name}」？\n${fix.address}\n\n請先確認這間 7-11 仍正常營業。啟用後，所有用這間門市的訂單都能轉單。`)) return
    run(async () => { await post('stores', { action: 'activate', store_id: fix.id }); await load(); setMessage(`已重新啟用門市「${fix.store_name}」`) })
  }
  const errorList = (errors: string[], fix?: StoreFix, storeName?: string | null) => <>
    {errors.map(e => <p className="text-amber-800" key={e}>{e}</p>)}
    {errors.some(e => e.includes('門市')) && <a href={`/admin/stores?q=${encodeURIComponent(fix?.store_name || storeName || '')}`} className="mt-1 inline-block text-xs font-bold text-green-700 underline">到門市管理查看 →</a>}
    {fix && <button type="button" className="mt-2 rounded-lg border border-green-600 bg-white px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 disabled:opacity-40" disabled={busy} onClick={() => activateStore(fix)}>門市正常營業，重新啟用</button>}
  </>
  const available = (data?.orders || []).filter(o => !o.reserved && !o.errors.length && o.marketplace_id === market)
  const unreserved = (data?.orders || []).filter(o => !o.reserved)
  const variants = Array.from(new Map(unreserved.flatMap(o => o.items).filter(i => i.variant_id !== null).map(i => [i.variant_id!, i])).entries())
  const transfers = (data?.transfers || []).filter(t => t.marketplace_id === market)

  // ── 團購：依溫層對應賣場 ──
  const currentMarket = data?.markets.find(m => m.id === market)
  const gbAll = (data?.groupBuyOrders || []).filter(o => !o.reserved)
  const gbAvailable = gbAll.filter(o => !o.errors.length && o.temperature === currentMarket?.temperature && currentMarket?.enabled)
  const gbOtherTemp = gbAll.filter(o => !o.errors.length && o.temperature && o.temperature !== currentMarket?.temperature)
  const otherTemp = gbOtherTemp[0]?.temperature
  const otherTempMarket = otherTemp ? data?.markets.find(m => m.enabled && m.temperature === otherTemp) : undefined
  const gbCampaigns = Array.from(new Map(gbAll.map(o => [o.campaign_id, o.campaign_title])).entries())
  const toggleGb = (id: number) => setSelectedGb(old => old.includes(id) ? old.filter(v => v !== id) : [...old, id].slice(0, 500))
  const exportGroupBuyBatch = () => run(async () => {
    const batch = crypto.randomUUID()
    try {
      await post('batches', { source: 'group_buy', batch_id: batch, group_buy_order_ids: selectedGb, marketplace_id: market })
      await download(batch)
      setMessage('已產生團購訂單的官方匯入檔。請到賣貨便匯入，成功後在批次紀錄核對編號，團購訂單會自動改成已出貨。')
    } finally {
      setTab('history')
      await load()
    }
  })
  const toggle = (id: number) => setSelected(old => old.includes(id) ? old.filter(v => v !== id) : [...old, id].slice(0, 500))
  const download = async (id: string) => {
    const response = await fetch(`/api/admin/myship/batches/${id}`, { cache: 'no-store' })
    if (!response.ok) throw new Error((await response.json()).error || '下載失敗')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a'); link.href = url; link.download = `myship-${id}.xlsm`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  const exportBatch = () => run(async () => {
    const batch = crypto.randomUUID()
    try {
      await post('batches', { batch_id: batch, order_ids: selected, marketplace_id: market })
      await download(batch)
      setMessage('已產生官方匯入檔。請到賣貨便匯入，成功後在批次紀錄核對編號。')
    } finally {
      setTab('history')
      await load()
    }
  })

  const readResult = (batch: string, file: File) => run(async () => {
    if (file.size > 2_000_000) throw new Error('結果檔超過2 MB限制')
    const response = await fetch(`/api/admin/myship/results?batch_id=${batch}&apply=true`, { method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: file })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '結果核對失敗')
    setMessage(`已核對 ${result.confirmed} 筆成功訂單並更新出貨。${result.unresolved.length ? `仍有 ${result.unresolved.length} 筆待處理：${result.unresolved.slice(0, 3).map((r: { order_no: string; reason: string }) => `${r.order_no} ${r.reason}`).join('；')}` : ''}`)
    await load()
  })

  return <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8 text-slate-800">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
      <div><p className="mb-2 text-sm text-slate-500">健康優選／訂單作業</p><h1 className="text-3xl font-bold tracking-tight">賣貨便轉單</h1><p className="mt-3 text-sm text-slate-600">整理待確認訂單、下載匯入檔，核對成功後更新出貨。</p></div>
      <button className={outline} disabled={busy} onClick={() => run(load)}>重新整理</button>
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {message && <div role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{message}</div>}
    {view === 'shop' && <AssistantPanel selected={selected} market={market} disabled={busy} onChange={load}/>}
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="market" className="font-medium">處理賣場</label>
      <select id="market" className="rounded-lg border p-2.5" value={market} disabled={busy || !data} onChange={e => { setMarket(e.target.value); setSelected([]); setSelectedGb([]) }}>
        {!data && <option>載入中</option>}{data?.markets.map(m => <option key={m.id} value={m.id} disabled={!m.enabled}>{m.name}（{m.temperature}）{m.enabled ? '' : '（未啟用）'}</option>)}
      </select>
      <span className="text-sm text-slate-500">代收原訂單總額（團購含運費），運費欄填 0 元</span>
    </div>
    <nav aria-label="轉單工作區" className="flex gap-6 border-b">
      {([['orders','待處理訂單'],['mapping','商品賣場配對'],['history','批次紀錄']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`pb-3 text-sm font-semibold ${tab === key ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500'}`} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}
    </nav>
    {!data && !error && <p role="status">正在讀取訂單…</p>}
    {/* ── 一般訂單／團購訂單切換：顏色區分（一般＝深灰、團購＝藍） ── */}
    {data && tab === 'orders' && <div role="tablist" aria-label="訂單種類" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:inline-grid sm:w-auto">
      {([
        ['shop', '📦 一般訂單', unreserved.length, 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'],
        ['group_buy', '🧊 團購訂單', gbAll.length, 'bg-sky-600 text-white shadow-sm'],
      ] as const).map(([key, label, n, activeCls]) => (
        <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold transition-colors ${view === key ? activeCls : 'text-slate-600 hover:bg-white/60'}`}>
          {label}
          <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${view === key ? (key === 'group_buy' ? 'bg-white/25' : 'bg-slate-100') : 'bg-slate-200'}`}>{n}</span>
        </button>
      ))}
    </div>}

    {/* ── 團購訂單 ── */}
    {data && tab === 'orders' && view === 'group_buy' && <section className="space-y-4" aria-label="團購訂單">
      {!data.groupBuyReady && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        團購轉單尚未啟用：請先在 Supabase SQL Editor 執行 <code className="rounded bg-white px-1">migrations/myship_group_buy.sql</code>。
      </div>}
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-900">
        <p className="font-bold">團購訂單依溫層自動對應賣場，不需要商品配對</p>
        <p className="mt-1">7-11 冷凍 → 冷凍賣場　·　7-11 常溫 → 常溫賣場　·　代收金額＝團購應收總額（含團購運費）　·　黑貓宅配不走賣貨便</p>
        <p className="mt-2">目前賣場：<b>{currentMarket ? `${currentMarket.name}（${currentMarket.temperature}）` : '—'}</b>，可匯出 <b>{gbAvailable.length}</b> 筆 7-11 {currentMarket?.temperature || ''}訂單</p>
        {gbOtherTemp.length > 0 && <p className="mt-1 font-semibold text-sky-800">
          另有 {gbOtherTemp.length} 筆 7-11 {otherTemp}訂單，{otherTempMarket
            ? <button className="underline" onClick={() => { setMarket(otherTempMarket.id); setSelectedGb([]) }}>切換到「{otherTempMarket.name}」處理 →</button>
            : <span className="text-amber-800">尚未設定{otherTemp}賣場（複製 migrations/myship_add_marketplace.sql，溫層填「{otherTemp}」）</span>}
        </p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p><strong>{gbAvailable.length}</strong> 筆可匯出 · 已選 {selectedGb.length} 筆 / 上限 500</p>
        <div className="flex gap-2">
          <button className={outline} disabled={busy || !gbAvailable.length} onClick={() => setSelectedGb(gbAvailable.slice(0, 500).map(o => o.id))}>選取可匯出團購訂單</button>
          <button className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-40" disabled={busy || !selectedGb.length} onClick={exportGroupBuyBatch}>{busy ? '處理中…' : '建立並下載團購匯入檔'}</button>
        </div>
      </div>
      {/* 依團購檔期分組 */}
      {gbCampaigns.map(([campaignId, title]) => {
        const rows = gbAll.filter(o => o.campaign_id === campaignId)
        return <div key={campaignId} className="overflow-hidden rounded-xl border border-sky-200">
          <div className="flex flex-wrap items-center gap-2 bg-sky-50 px-4 py-3">
            <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-bold text-white">團購</span>
            <h3 className="font-bold text-slate-900">{title || '團購'}</h3>
            <span className="text-sm text-slate-500">{rows.length} 筆待出貨</span>
          </div>
          <div className="overflow-x-auto bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['選取', '訂單／收件人', '商品', '取貨', '代收金額', '檢查結果'].map(h => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y">
            {rows.map(o => {
              const selectable = gbAvailable.some(a => a.id === o.id)
              const tempMismatch = !o.errors.length && o.temperature !== currentMarket?.temperature
              return <tr key={o.id} className={`align-top ${selectedGb.includes(o.id) ? 'bg-sky-50/60' : ''}`}>
                <td className="p-3"><input aria-label={`選取 ${o.order_no}`} type="checkbox" className="h-4 w-4 accent-sky-700" checked={selectable && selectedGb.includes(o.id)} disabled={busy || !selectable} onChange={() => toggleGb(o.id)}/></td>
                <td className="p-3 whitespace-nowrap"><p className="font-mono font-medium">{o.order_no}</p><p className="mt-1 text-slate-600">{o.customer_name}</p></td>
                <td className="p-3">{o.items.map((i, n) => <p key={n}>{i.name}{i.spec && <span className="text-slate-500">（{i.spec}）</span>} ×{i.quantity}</p>)}</td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${o.temperature === '冷凍' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{o.temperature === '冷凍' ? '🧊 7-11 冷凍' : '🏪 7-11 常溫'}</span>
                  <p className="mt-1 text-slate-600">{o.store_name}門市</p>
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums"><p className="font-semibold">{money(o.total_amount)}</p>{o.shipping_fee > 0 && <p className="text-xs text-slate-500">含運費 {money(o.shipping_fee)}</p>}</td>
                <td className="p-3 min-w-44">{o.errors.length ? errorList(o.errors, o.store_fix, o.store_name)
                  : tempMismatch ? <span className="text-slate-500">屬於{o.temperature}賣場</span>
                  : !currentMarket?.enabled ? <span className="text-slate-500">賣場未啟用</span>
                  : <span className="font-semibold text-green-800">可匯出</span>}</td>
              </tr>
            })}
          </tbody></table></div>
        </div>
      })}
      {!gbAll.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">沒有尚未匯出的團購訂單（待出貨、7-11 取貨）。已匯出的請到批次紀錄核對。</p>}
    </section>}

    {data && tab === 'orders' && view === 'shop' && <section className="space-y-4" aria-label="一般訂單">
      <div className="flex flex-wrap items-center justify-between gap-3"><p><strong>{available.length}</strong> 筆可匯出 · 已選 {selected.length} 筆 / 上限 500</p><div className="flex gap-2"><button className={outline} disabled={busy || !available.length} onClick={() => setSelected(available.slice(0, 500).map(o => o.order_id))}>選取可匯出訂單</button><button className={button} disabled={busy || !selected.length} onClick={exportBatch}>{busy ? '處理中…' : '建立並下載匯入檔'}</button></div></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['選取','訂單／收件人','商品','門市','代收金額','檢查結果'].map(s => <th key={s} className="p-4">{s}</th>)}</tr></thead><tbody className="divide-y">
        {/* 拆單的訂單在清單裡會有兩列、共用同一個 order_id，所以 key 與勾選都要
            連同賣場一起判斷 —— 只看 order_id 的話 key 會重複，勾一列兩列一起勾。
            勾選本身只存 order_id 沒問題：可勾的永遠只有目前賣場那一列。 */}
        {unreserved.map(o => {
          const selectable = o.marketplace_id === market && available.some(a => a.order_id === o.order_id && a.marketplace_id === o.marketplace_id)
          return <tr key={`${o.order_id}:${o.marketplace_id}`} className="align-top"><td className="p-4"><input aria-label={`選取 ${o.order_no}`} type="checkbox" checked={selectable && selected.includes(o.order_id)} disabled={busy || !selectable} onChange={() => toggle(o.order_id)}/></td><td className="p-4 whitespace-nowrap"><p className="font-medium">{o.order_no}</p><p className="mt-1 text-slate-500">{o.customer_name}</p>{o.parts > 1 && <p className="mt-1.5 inline-block rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">拆單 {o.part}/{o.parts}</p>}</td><td className="p-4">{o.items.map((i, n) => <p key={n}>{i.sku} {i.name} · {i.variant}</p>)}</td><td className="p-4 whitespace-nowrap">{o.store_name}</td><td className="p-4 whitespace-nowrap tabular-nums">{money(o.total_amount)}{o.parts > 1 && <p className="mt-1 text-xs text-slate-500">原訂單 {money(o.order_total)}</p>}</td><td className="p-4 min-w-48">{o.errors.length ? errorList(o.errors, o.store_fix, o.store_name) : o.marketplace_id === market ? <span className="text-green-800">可匯出</span> : o.parts > 1 ? `這一半屬於其他賣場（${(data?.markets || []).find(m => m.id === o.marketplace_id)?.name || o.marketplace_id}）` : '屬於其他賣場'}</td></tr>
        })}
        {!unreserved.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">沒有尚未匯出的待確認訂單。已匯出的訂單請到批次紀錄核對。</td></tr>}
      </tbody></table></div>
    </section>}
    {data && tab === 'mapping' && <section className="space-y-4"><p className="text-sm text-slate-600">為待處理商品設定一次所屬賣場，之後相同規格會自動套用。未設定的商品不會匯出。<span className="ml-1 text-sky-800">團購訂單依溫層自動對應賣場，不需要在這裡設定。</span></p>
      <div className="divide-y rounded-xl border">{variants.map(([id, item]) => <div key={id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-semibold">{item.sku} {item.name}</p><p className="text-sm text-slate-500">{item.variant}</p></div><select aria-label={`${item.name} ${item.variant} 所屬賣場`} className="rounded-lg border p-2" disabled={busy} value={data.mappings.find(m => m.variant_id === id)?.marketplace_id || ''} onChange={e => { const value = e.target.value; run(async () => { await post('mappings', { variant_id: id, marketplace_id: value }); await load() }) }}><option value="">尚未配對</option>{data.markets.filter(m => m.enabled).map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></div>)}{!variants.length && <p className="p-6 text-slate-500">目前沒有待設定的商品。</p>}</div>
    </section>}
    {data && tab === 'history' && <section className="space-y-4"><p className="text-sm text-slate-600">顯示全部待核對紀錄與最近 100 筆已完成紀錄。待核對的批次會持續保留，不需為了處理其他訂單而解除保留。下載檔案尚不代表賣貨便已成立訂單；請核對成功訂單的收件人、商品和金額，再記錄編號。</p>
      <BatchHistory transfers={transfers} busy={busy}
        onDownload={batch => run(async () => { await download(batch); setMessage('已重新下載同一批檔案。請先確認此批尚未匯入賣貨便。') })}
        onReadResult={readResult}
        onConfirm={t => { setConfirming(transfers.find(x => x.id === t.id) || null); setExternal(''); setVerified(false); setNotCreated(false); setReason(''); setError('') }}/>
    </section>}
    {confirming && <section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"><h2 id="confirm-title" className="text-xl font-bold">核對賣貨便已成立的訂單</h2><p>{confirming.import_row[9]}</p><p>{confirming.import_row[0]} · 店號 {confirming.import_row[2]} · {money(Number(confirming.import_row[5]))}</p><p className="text-sm">{confirming.import_row[4]}</p><label className="block">賣貨便訂單編號<input autoFocus className="mt-2 w-full rounded-lg border p-3" placeholder="CM開頭的訂單編號" value={external} onChange={e => setExternal(e.target.value.trim().toUpperCase())}/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1"/>我已在賣貨便核對此編號的收件人、商品、門市和代收金額，確認訂單成立。</label>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button className={outline} disabled={busy} onClick={() => setConfirming(null)}>取消</button><button className={button} disabled={busy || !verified || !/^CM\d{13}$/.test(external)} onClick={() => run(async () => { await post('confirm', { transfer_id: confirming.id, external_order_no: external, verified }); setConfirming(null); await load(); setMessage('已記錄賣貨便編號，健康優選訂單已更新為已出貨。') })}>記錄並更新已出貨</button></div><details className="border-t pt-3 text-sm"><summary className="cursor-pointer text-slate-600">未匯入或明確失敗，需要修正後重做</summary><p className="mt-3">已成立或結果不明的訂單，請關閉此視窗，在助手按「保留此批，繼續其他訂單」。只有確定賣貨便沒有成立此筆訂單才能解除。</p><label className="mt-3 flex gap-2"><input type="checkbox" checked={notCreated} onChange={e => setNotCreated(e.target.checked)}/>我已核對此筆未在賣貨便成立，且不再使用原批次檔案。</label><label className="mt-3 block">核對原因<textarea className="mt-2 w-full rounded border p-2" maxLength={200} value={reason} onChange={e => setReason(e.target.value)}/></label><button className={outline} disabled={busy || !notCreated || reason.trim().length < 5} onClick={() => run(async () => { await post('release', { transfer_id: confirming.id, reason, verified_not_created: true }); setConfirming(null); await load(); setMessage('已保留核對紀錄並解除匯出保留，可回待處理訂單修正後重做。') })}>解除保留</button></details></div></section>}
  </main>
}
