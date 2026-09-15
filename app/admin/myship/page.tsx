'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Marketplace, Mapping, PreparedOrder } from '@/lib/myship/domain'
import AssistantPanel from './AssistantPanel'

type Item = { variant_id: number | null; name: string; variant: string; sku: string | null }
type Row = PreparedOrder & { customer_name: string; total_amount: number; store_name: string; reserved: boolean; items: Item[] }
type Transfer = { id: string; order_id: number | null; marketplace_id: string; batch_id: string; status: string; external_order_no: string | null; created_at: string; import_row: string[] }
type Data = { orders: Row[]; markets: Marketplace[]; mappings: Mapping[]; transfers: Transfer[] }
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
  const [market, setMarket] = useState('GM2601252733206')
  const [tab, setTab] = useState<'orders' | 'mapping' | 'history'>('orders')
  const [selected, setSelected] = useState<number[]>([])
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
  }, [])
  useEffect(() => { load().catch(e => setError(e.message)) }, [load])
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : '操作失敗') } finally { setBusy(false) }
  }
  const available = (data?.orders || []).filter(o => !o.reserved && !o.errors.length && o.marketplace_id === market)
  const unreserved = (data?.orders || []).filter(o => !o.reserved)
  const variants = Array.from(new Map(unreserved.flatMap(o => o.items).filter(i => i.variant_id !== null).map(i => [i.variant_id!, i])).entries())
  const transfers = (data?.transfers || []).filter(t => t.marketplace_id === market)
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
      await post('batches', { batch_id: batch, order_ids: selected })
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
    <AssistantPanel selected={selected} market={market} disabled={busy} onChange={load}/>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="market" className="font-medium">處理賣場</label>
      <select id="market" className="rounded-lg border p-2.5" value={market} disabled={busy || !data} onChange={e => { setMarket(e.target.value); setSelected([]) }}>
        {!data && <option>載入中</option>}{data?.markets.map(m => <option key={m.id} value={m.id} disabled={!m.enabled}>{m.name}{m.enabled ? '' : '（未啟用）'}</option>)}
      </select>
      <span className="text-sm text-slate-500">代收原訂單總額，運費欄填 0 元</span>
    </div>
    <nav aria-label="轉單工作區" className="flex gap-6 border-b">
      {([['orders','待處理訂單'],['mapping','商品賣場配對'],['history','批次紀錄']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`pb-3 text-sm font-semibold ${tab === key ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500'}`} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}
    </nav>
    {!data && !error && <p role="status">正在讀取訂單…</p>}
    {data && tab === 'orders' && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p><strong>{available.length}</strong> 筆可匯出 · 已選 {selected.length} 筆 / 上限 500</p><div className="flex gap-2"><button className={outline} disabled={busy || !available.length} onClick={() => setSelected(available.slice(0, 500).map(o => o.order_id))}>選取可匯出訂單</button><button className={button} disabled={busy || !selected.length} onClick={exportBatch}>{busy ? '處理中…' : '建立並下載匯入檔'}</button></div></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['選取','訂單／收件人','商品','門市','代收金額','檢查結果'].map(s => <th key={s} className="p-4">{s}</th>)}</tr></thead><tbody className="divide-y">
        {unreserved.map(o => <tr key={o.order_id} className="align-top"><td className="p-4"><input aria-label={`選取 ${o.order_no}`} type="checkbox" checked={selected.includes(o.order_id)} disabled={busy || !available.some(a => a.order_id === o.order_id)} onChange={() => toggle(o.order_id)}/></td><td className="p-4 whitespace-nowrap"><p className="font-medium">{o.order_no}</p><p className="mt-1 text-slate-500">{o.customer_name}</p></td><td className="p-4">{o.items.map((i, n) => <p key={n}>{i.sku} {i.name} · {i.variant}</p>)}</td><td className="p-4 whitespace-nowrap">{o.store_name}</td><td className="p-4 whitespace-nowrap tabular-nums">{money(o.total_amount)}</td><td className="p-4 min-w-48">{o.errors.length ? o.errors.map(e => <p className="text-amber-800" key={e}>{e}</p>) : o.marketplace_id === market ? <span className="text-green-800">可匯出</span> : '屬於其他賣場'}</td></tr>)}
        {!unreserved.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">沒有尚未匯出的待確認訂單。已匯出的訂單請到批次紀錄核對。</td></tr>}
      </tbody></table></div>
    </section>}
    {data && tab === 'mapping' && <section className="space-y-4"><p className="text-sm text-slate-600">為待處理商品設定一次所屬賣場，之後相同規格會自動套用。未設定的商品不會匯出。</p>
      <div className="divide-y rounded-xl border">{variants.map(([id, item]) => <div key={id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-semibold">{item.sku} {item.name}</p><p className="text-sm text-slate-500">{item.variant}</p></div><select aria-label={`${item.name} ${item.variant} 所屬賣場`} className="rounded-lg border p-2" disabled={busy} value={data.mappings.find(m => m.variant_id === id)?.marketplace_id || ''} onChange={e => { const value = e.target.value; run(async () => { await post('mappings', { variant_id: id, marketplace_id: value }); await load() }) }}><option value="">尚未配對</option>{data.markets.filter(m => m.enabled).map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></div>)}{!variants.length && <p className="p-6 text-slate-500">目前沒有待設定的商品。</p>}</div>
    </section>}
    {data && tab === 'history' && <section className="space-y-4"><p className="text-sm text-slate-600">顯示全部待核對紀錄與最近 100 筆已完成紀錄。待核對的批次會持續保留，不需為了處理其他訂單而解除保留。下載檔案尚不代表賣貨便已成立訂單；請核對成功訂單的收件人、商品和金額，再記錄編號。</p>
      <div className="space-y-5">{Array.from(new Set(transfers.map(t => t.batch_id))).map(batch => {
        const rows = transfers.filter(t => t.batch_id === batch)
        return <article key={batch} className="rounded-xl border"><header className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4"><div><h2 className="font-semibold">{new Date(rows[0].created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })} · {rows.length} 筆</h2><p className="mt-1 text-xs text-slate-500 break-all">批次 {batch}</p></div><button className={outline} disabled={busy || rows.some(t => t.status !== 'exported')} onClick={() => run(async () => { await download(batch); setMessage('已重新下載同一批檔案。請先確認此批尚未匯入賣貨便。') })}>重新下載原批次</button></header>
          {rows.some(t => t.status === 'exported') && <div className="border-t p-4"><label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium">讀取本批結果檔並更新已出貨<input type="file" accept=".xlsx" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) readResult(batch, file) }}/></label><p className="mt-2 text-xs text-slate-500">適用於匯入已完成、助手未能讀回結果的情況。系統會先比對原單號、收件資料、商品和金額。</p></div>}
          <div className="divide-y">{rows.map(t => <div className="flex flex-wrap items-center justify-between gap-4 p-4" key={t.id}><div><p className="font-medium">{t.import_row[9]}</p><p className="mt-1 text-sm">{t.import_row[0]} · 店號 {t.import_row[2]} · {money(Number(t.import_row[5]) + Number(t.import_row[6]))}</p><p className="mt-1 max-w-2xl text-sm text-slate-500">{t.import_row[4]}</p></div>{t.status === 'confirmed' ? <p className="text-sm text-green-800">已出貨 · {t.external_order_no}</p> : t.status === 'released' ? <p className="text-sm text-slate-500">已解除保留</p> : <button className={outline} disabled={busy} onClick={() => { setConfirming(t); setExternal(''); setVerified(false); setNotCreated(false); setReason(''); setError('') }}>核對成功編號</button>}</div>)}</div>
        </article>
      })}{!transfers.length && <p className="p-6 text-slate-500">尚無匯出批次。</p>}</div>
    </section>}
    {confirming && <section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"><h2 id="confirm-title" className="text-xl font-bold">核對賣貨便已成立的訂單</h2><p>{confirming.import_row[9]}</p><p>{confirming.import_row[0]} · 店號 {confirming.import_row[2]} · {money(Number(confirming.import_row[5]))}</p><p className="text-sm">{confirming.import_row[4]}</p><label className="block">賣貨便訂單編號<input autoFocus className="mt-2 w-full rounded-lg border p-3" placeholder="CM開頭的訂單編號" value={external} onChange={e => setExternal(e.target.value.trim().toUpperCase())}/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1"/>我已在賣貨便核對此編號的收件人、商品、門市和代收金額，確認訂單成立。</label>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button className={outline} disabled={busy} onClick={() => setConfirming(null)}>取消</button><button className={button} disabled={busy || !verified || !/^CM\d{13}$/.test(external)} onClick={() => run(async () => { await post('confirm', { transfer_id: confirming.id, external_order_no: external, verified }); setConfirming(null); await load(); setMessage('已記錄賣貨便編號，健康優選訂單已更新為已出貨。') })}>記錄並更新已出貨</button></div><details className="border-t pt-3 text-sm"><summary className="cursor-pointer text-slate-600">未匯入或明確失敗，需要修正後重做</summary><p className="mt-3">已成立或結果不明的訂單，請關閉此視窗，在助手按「保留此批，繼續其他訂單」。只有確定賣貨便沒有成立此筆訂單才能解除。</p><label className="mt-3 flex gap-2"><input type="checkbox" checked={notCreated} onChange={e => setNotCreated(e.target.checked)}/>我已核對此筆未在賣貨便成立，且不再使用原批次檔案。</label><label className="mt-3 block">核對原因<textarea className="mt-2 w-full rounded border p-2" maxLength={200} value={reason} onChange={e => setReason(e.target.value)}/></label><button className={outline} disabled={busy || !notCreated || reason.trim().length < 5} onClick={() => run(async () => { await post('release', { transfer_id: confirming.id, reason, verified_not_created: true }); setConfirming(null); await load(); setMessage('已保留核對紀錄並解除匯出保留，可回待處理訂單修正後重做。') })}>解除保留</button></details></div></section>}
  </main>
}
