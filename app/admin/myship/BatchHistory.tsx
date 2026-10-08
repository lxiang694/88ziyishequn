'use client'

import { useState } from 'react'

export type HistoryTransfer = {
  id: string; batch_id: string; status: string; external_order_no: string | null
  created_at: string; import_row: string[]
}

const money = (n: number) => `NT$${n.toLocaleString('zh-TW')}`
const outline = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40'

const STATUS = {
  exported: { label: '待核對', pill: 'bg-amber-100 text-amber-900', stripe: 'border-l-amber-400' },
  confirmed: { label: '已出貨', pill: 'bg-green-100 text-green-800', stripe: 'border-l-green-500' },
  released: { label: '已解除', pill: 'bg-slate-200 text-slate-600', stripe: 'border-l-slate-300' },
} as const
const statusOf = (s: string) => STATUS[s as keyof typeof STATUS] || STATUS.released

/**
 * 賣貨便批次紀錄。
 *
 * 版面分兩層顏色：批次（時間點）是有底色的標題列，底下每筆訂單是白色列，
 * 左邊用色條標狀態 —— 一眼分得出「這是哪一批」和「這一批裡的哪一筆」。
 *
 * 每批可以收合。預設只展開還有「待核對」的批次：那些才需要動手處理；
 * 全部核對完的批次收起來，只留標題列上的狀態統計。
 */
export default function BatchHistory({ transfers, busy, onDownload, onReadResult, onConfirm }: {
  transfers: HistoryTransfer[]
  busy: boolean
  onDownload: (batch: string) => void
  onReadResult: (batch: string, file: File) => void
  onConfirm: (transfer: HistoryTransfer) => void
}) {
  // 只記使用者手動切換過的批次；沒切換過的照「有沒有待核對」決定
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const batches = Array.from(new Set(transfers.map(t => t.batch_id))).map(batch => {
    const rows = transfers.filter(t => t.batch_id === batch)
    const pending = rows.filter(t => t.status === 'exported').length
    return { batch, rows, pending, open: toggled[batch] ?? pending > 0 }
  })
  const setAll = (open: boolean) => setToggled(Object.fromEntries(batches.map(b => [b.batch, open])))

  if (!batches.length) return <p className="p-6 text-slate-500">尚無匯出批次。</p>

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-600">共 {batches.length} 批，其中 {batches.filter(b => b.pending).length} 批還有待核對的訂單</p>
      <div className="flex gap-2">
        <button className={outline} onClick={() => setAll(true)}>全部展開</button>
        <button className={outline} onClick={() => setAll(false)}>全部收起</button>
      </div>
    </div>

    {batches.map(({ batch, rows, pending, open }) => {
      const counts = (['exported', 'confirmed', 'released'] as const)
        .map(s => ({ s, n: rows.filter(t => t.status === s).length })).filter(c => c.n)
      return <article key={batch} className={`overflow-hidden rounded-xl border ${pending ? 'border-amber-300' : 'border-slate-200'}`}>
        {/* 批次標題列：有底色，跟下面白色的訂單列分開 */}
        <header className={`flex flex-wrap items-center gap-3 p-3 sm:p-4 ${pending ? 'bg-amber-100/70' : 'bg-slate-100'}`}>
          <button type="button" aria-expanded={open} onClick={() => setToggled(t => ({ ...t, [batch]: !open }))}
            className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <svg className={`h-5 w-5 flex-shrink-0 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="whitespace-nowrap font-bold text-slate-900 tabular-nums">{new Date(rows[0].created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
                <span className="text-sm font-semibold text-slate-700">{rows.length} 筆</span>
                {counts.map(({ s, n }) => <span key={s} className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[s].pill}`}>{STATUS[s].label} {n}</span>)}
              </span>
              <span className="mt-1 block truncate text-xs text-slate-500">批次 {batch}</span>
            </span>
          </button>
          {open && <button className={`${outline} w-full sm:w-auto`} disabled={busy || rows.some(t => t.status !== 'exported')} onClick={() => onDownload(batch)}>重新下載原批次</button>}
        </header>

        {open && <>
          {pending > 0 && <div className="border-t border-amber-200 bg-amber-50/40 px-4 py-3">
            <label className="inline-flex cursor-pointer flex-wrap items-center gap-3 text-sm font-medium">讀取本批結果檔並更新已出貨<input type="file" accept=".xlsx" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onReadResult(batch, file) }}/></label>
            <p className="mt-1.5 text-xs text-slate-500">適用於匯入已完成、助手未能讀回結果的情況。系統會先比對原單號、收件資料、商品和金額。</p>
          </div>}

          {/* 訂單列：白底，左側色條標狀態 */}
          <div className="bg-white">{rows.map(t => {
            const st = statusOf(t.status)
            return <div key={t.id} className={`flex flex-wrap items-center justify-between gap-3 border-l-4 border-t border-t-slate-100 px-4 py-3.5 first:border-t-0 ${st.stripe}`}>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{t.import_row[9]}</p>
                <p className="mt-1 text-sm text-slate-700">{t.import_row[0]} · 店號 {t.import_row[2]} · <span className="font-semibold tabular-nums">{money(Number(t.import_row[5]) + Number(t.import_row[6]))}</span></p>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{t.import_row[4]}</p>
              </div>
              {t.status === 'confirmed'
                ? <p className="text-sm"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.pill}`}>{st.label}</span> <span className="ml-1 font-mono text-green-900">{t.external_order_no}</span></p>
                : t.status === 'released'
                ? <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.pill}`}>已解除保留</span>
                : <button className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40" disabled={busy} onClick={() => onConfirm(t)}>核對成功編號</button>}
            </div>
          })}</div>
        </>}
      </article>
    })}
  </div>
}
