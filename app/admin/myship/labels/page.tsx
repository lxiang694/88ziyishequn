'use client'

/**
 * 面單處理：把賣貨便批次列印的 PDF 拆成一張一檔，檔名就是訂單號。
 *
 * 現在的流程是一筆一筆來：在賣貨便搜訂單 → 取交貨便代碼 → 列印 → 另存
 * PDF → 手動把檔名打成訂單號 → 到新比銳選檔上傳。十筆就是十輪，而檔名
 * 全靠手打，打錯沒有任何東西會攔下來。
 *
 * 使用者給的樣本裡就有這個錯：CM2609214719432.pdf 跟 CM2609214719459.pdf
 * 兩個檔案裝的是同一張面單。前者的包裹會配到別人的面單，後者根本沒有面單。
 *
 * 改成：賣貨便勾選多筆一次列印 → 整份 PDF 丟進來 → 依面單上印的訂單號
 * 拆檔命名 → 下載 ZIP → 解壓後在新比銳一次多選上傳。
 *
 * 全部在瀏覽器裡跑，PDF 不會上傳到伺服器 —— 面單上有收件人與門市，沒有
 * 必要經過我們的機器。
 */

import { useMemo, useRef, useState } from 'react'
import { zipSync } from 'fflate'
import { parseOrderList, reconcile, MAX_ORDERS } from '@/lib/myship/labelOrders'
import { splitLabelPdf, labelFileName, LabelPdfError } from '@/lib/myship/labelPdf'

const button = 'rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-slate-700'
const outline = 'rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40'

interface Found {
  orderNo: string
  file: string
  page: number
  pdf: Uint8Array
}

interface Report {
  found: Found[]
  matched: string[]
  missing: string[]
  extra: string[]
  /** 同一個訂單號在多份 PDF 裡都出現 */
  duplicated: string[]
  warnings: string[]
}

export default function LabelsPage() {
  const [pasted, setPasted] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseOrderList(pasted), [pasted])
  const requested = parsed.orderNos

  const reset = () => { setReport(null); setError('') }

  const run = async () => {
    setBusy(true); setError(''); setReport(null)
    try {
      const found: Found[] = []
      const warnings: string[] = [...parsed.warnings]

      for (const file of files) {
        const raw = new Uint8Array(await file.arrayBuffer())
        const result = splitLabelPdf(raw)
        for (const w of result.warnings) warnings.push(`${file.name}：${w}`)
        for (const label of result.labels) {
          found.push({ orderNo: label.orderNo, file: file.name, page: label.page, pdf: label.pdf })
        }
      }

      // 同一個訂單號在多份 PDF 出現：通常是同一批印了兩次，保留最後一份
      const byOrder = new Map<string, Found>()
      const duplicated: string[] = []
      for (const f of found) {
        if (byOrder.has(f.orderNo)) duplicated.push(f.orderNo)
        byOrder.set(f.orderNo, f)
      }

      const inPdf = [...byOrder.keys()]
      // 沒有貼清單時就以 PDF 裡的為準，全部輸出
      const rec = requested.length > 0
        ? reconcile(requested, inPdf)
        : { matched: inPdf, missing: [], extra: [] }

      if (rec.matched.length === 0) {
        throw new Error(requested.length > 0
          ? '清單上的訂單號，這幾份 PDF 裡一張都沒有。請確認是不是印到別批了'
          : '這幾份 PDF 裡找不到面單')
      }

      setReport({
        found, matched: rec.matched, missing: rec.missing, extra: rec.extra,
        duplicated: [...new Set(duplicated)], warnings,
      })
    } catch (e) {
      setError(e instanceof LabelPdfError || e instanceof Error ? e.message : '處理失敗')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!report) return
    const byOrder = new Map<string, Found>(report.found.map(f => [f.orderNo, f]))
    const entries: Record<string, Uint8Array> = {}
    for (const no of report.matched) {
      const f = byOrder.get(no)
      if (f) entries[labelFileName(no)] = f.pdf
    }
    const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace(/[^\d]/g, '').slice(0, 12)
    const bytes = zipSync(entries, { level: 6 })
    // 取出底層 buffer 再交給 Blob —— 直接丟 Uint8Array 在較新的 TS 型別下
    // 不算合法的 BlobPart（可能是 SharedArrayBuffer 撐起來的）
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/zip' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `面單-${stamp}-${report.matched.length}筆.zip`
    link.click()
    // 立刻 revoke 會讓部分瀏覽器來不及下載，讓這一輪事件跑完再收
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-bold">面單處理</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          在賣貨便「賣家訂單」勾選這批要出的訂單，按「取交貨便代碼 → 列印交貨便代碼」，
          另存成 PDF（檔名隨便取），整份丟進來。三個賣場就丟三份。
          下載的 ZIP 解壓後，在新比銳的「蝦皮面單上傳」一次全選就好。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          檔案只在你的瀏覽器裡處理，不會上傳到伺服器。
        </p>
      </header>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">1. 這批要出哪幾筆</h2>
        <p className="mt-1 text-xs text-slate-500">
          可以留空（留空就是把 PDF 裡的面單全部輸出）。貼上清單的話會多一道核對，
          漏印、多印都會告訴你。從賣貨便整塊複製也可以，中間夾雜日期金額沒關係。
        </p>
        <textarea
          value={pasted}
          onChange={e => { setPasted(e.target.value); reset() }}
          rows={5}
          placeholder={'CM2609214719432\nCM2609214719459\nCM2609214719479'}
          className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
        />
        <p className="mt-2 text-xs text-slate-600">
          {requested.length > 0
            ? `已認出 ${requested.length} 筆${requested.length >= MAX_ORDERS ? `（上限 ${MAX_ORDERS}）` : ''}`
            : '尚未貼上訂單號'}
          {parsed.warnings.length > 0 && (
            <span className="ml-2 text-amber-700">{parsed.warnings.join('；')}</span>
          )}
        </p>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">2. 賣貨便印出來的 PDF</h2>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={e => { setFiles(Array.from(e.target.files || [])); reset() }}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {files.map(f => (
              <li key={f.name}>· {f.name}（{Math.round(f.size / 1024)} KB）</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={busy || files.length === 0} onClick={run}>
          {busy ? '處理中…' : '開始拆檔'}
        </button>
        {report && (
          <button className={button} onClick={download}>
            下載 ZIP（{report.matched.length} 個檔案）
          </button>
        )}
        {(files.length > 0 || report) && (
          <button
            className={outline}
            disabled={busy}
            onClick={() => { setFiles([]); reset(); if (fileInput.current) fileInput.current.value = '' }}
          >
            清空重來
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {report && (
        <section className="space-y-4">
          {report.missing.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4">
              <h3 className="font-semibold text-red-900">漏印 {report.missing.length} 筆 —— 這幾筆沒有面單</h3>
              <p className="mt-1 text-sm text-red-800">
                回賣貨便把這幾筆補印，再把新的 PDF 一起丟進來。包裹照出、面單沒傳，
                貨到新比銳那邊會對不上。
              </p>
              <ul className="mt-2 font-mono text-sm text-red-900">
                {report.missing.map(no => <li key={no}>{no}</li>)}
              </ul>
            </div>
          )}

          {report.extra.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900">多印 {report.extra.length} 筆 —— 不會放進 ZIP</h3>
              <p className="mt-1 text-sm text-amber-800">
                PDF 裡有但不在清單上。這幾筆的貨這次沒有要出，面單先不要傳，
                不然倉庫會等一個不會到的包裹。
              </p>
              <ul className="mt-2 font-mono text-sm text-amber-900">
                {report.extra.map(no => <li key={no}>{no}</li>)}
              </ul>
            </div>
          )}

          {report.duplicated.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              下列訂單在多份 PDF 裡都有，已取最後一份：
              <span className="ml-1 font-mono">{report.duplicated.join('、')}</span>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {report.warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}

          <div className="rounded-xl border">
            <header className="border-b bg-slate-50 p-4">
              <h3 className="font-semibold">將輸出 {report.matched.length} 個檔案</h3>
            </header>
            <ul className="divide-y text-sm">
              {report.matched.map(no => {
                const f = report.found.find(x => x.orderNo === no)!
                return (
                  <li key={no} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                    <span className="font-mono">{labelFileName(no)}</span>
                    <span className="text-xs text-slate-500">來自 {f.file} 第 {f.page} 頁</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
