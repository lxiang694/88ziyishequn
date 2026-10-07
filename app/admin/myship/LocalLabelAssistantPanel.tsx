'use client'

import { useEffect, useRef, useState } from 'react'
import { buildLabelHandoff, validateLabelResults, LOCAL_LABEL_ASSISTANT, PAIRING_STORAGE_KEY } from '@/lib/myship/localLabelAssistant'

type Transfer = { id: string; external_order_no: string; marketplace_id: string; import_row: string[] }
type Receipt = { order_no: string; status: string; warnings: string[]; verification: string }
const endpoint = '/api/admin/myship/labels/assistant'
const outline = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40'

async function request(body?: unknown) {
  const response = await fetch(endpoint, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '面單助手連線失敗')
  return data
}

export default function LocalLabelAssistantPanel({ market, orderNos }: { market?: string; orderNos?: string[] }) {
  const [pairing, setPairing] = useState('')
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Transfer[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [upload, setUpload] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const target = useRef<Window | null>(null)
  const active = useRef<{ requestId: string; orderNos: string[] } | null>(null)
  const [retryResult, setRetryResult] = useState<unknown>(null)
  const queue = useRef(Promise.resolve())
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async () => {
    const data = await request()
    setRows(data.transfers); setReceipts(data.receipts || [])
    if (data.setupRequired) setError('面單紀錄尚未啟用：請執行 migrations/myship_label_assistant.sql 後重新整理')
  }
  const saveResult = async (body: unknown) => {
    try {
      const r = await request(body)
      setRetryResult(null); setError('')
      setMessage(`已回填 ${r.uploaded} 筆上傳成功結果；其餘狀態已保留。`)
      await load()
    } catch (e) {
      setRetryResult(body)
      setError(`${e instanceof Error ? e.message : '回填失敗'}。本機紀錄仍保留，可按「重試回填」。`)
    }
  }
  useEffect(() => {
    setPairing(localStorage.getItem(PAIRING_STORAGE_KEY) || '')
    load().catch(e => setError(e.message))
    const receive = (event: MessageEvent) => {
      if (event.origin !== LOCAL_LABEL_ASSISTANT || event.source !== target.current || !active.current) return
      const data = event.data
      if (!data || data.requestId !== active.current.requestId) return
      if (data.type === 'health-myship-label-accepted') {
        if (ackTimer.current) clearTimeout(ackTimer.current)
        setMessage('本機助手已接收，正在處理；請保留此頁及助手分頁。')
      } else if (data.type === 'health-myship-label-result') {
        try {
          setBusy(false)
          if (ackTimer.current) clearTimeout(ackTimer.current)
          const results = validateLabelResults(data.results, active.current.orderNos)
          const body = { action: 'results', requestId: active.current.requestId, results }
          queue.current = queue.current.then(() => saveResult(body))
        } catch (e) { setError(e instanceof Error ? e.message : '結果核對失敗') }
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
    // Bind the receiver once; active task and popup identity are held in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    const ids = rows.filter(r => selected.includes(r.id) && (!market || r.marketplace_id === market)).map(r => r.id)
    const nos = orderNos?.length ? orderNos : undefined
    // Open within the click event so popup blockers cannot discard an async launch.
    const popup = window.open('about:blank', 'health-myship-label-assistant')
    if (!popup) { setError('請允許健康優選開啟助手分頁'); return }
    target.current = popup
    setBusy(true); setError(''); setMessage('正在送單…')
    try {
      if (!/^[A-Za-z0-9_-]{40,80}$/.test(pairing.trim())) throw new Error('請先填入本機助手配對碼')
      const response = await request({ action: 'handoff', requestId: crypto.randomUUID(), transferIds: ids, orderNos: nos })
      active.current = { requestId: response.requestId, orderNos: response.orderNos }
      popup.location.href = buildLabelHandoff({ key: pairing.trim(), requestId: response.requestId,
        orderNos: response.orderNos, source: location.origin, upload })
      ackTimer.current = setTimeout(() => { setBusy(false); setError('尚未收到助手確認，請先啟動助手並檢查該分頁。'); }, 30000)
      const skipped = response.skipped?.length ? `（${response.skipped.length} 筆已上傳過，已跳過：${response.skipped.join('、')}）` : ''
      setMessage(`已送出 ${response.orderNos.length} 筆${skipped}；助手啟動後會回報結果。若分頁無法連線，請先啟動本機助手。`)
    } catch (e) {
      popup.close(); setError(e instanceof Error ? e.message : '送單失敗')
    setBusy(false)
    }
  }
  const visible = rows.filter(r => !market || r.marketplace_id === market)
  return <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-slate-900">本機面單助手</h2><p className="mt-1 text-sm text-slate-600">送出已成立的 CM 訂單，取得 PDF 後交由新比銳識別及上傳。</p></div>
      <button className={outline} onClick={() => setEditing(v => !v)}>面單助手配對</button>
    </div>
    {(editing || !pairing) && <div className="space-y-2 text-sm">
      <p>先啟動本機助手，在助手按「複製本機配對碼」，貼到下方並儲存。只需配對一次。</p>
      <label className="block">本機配對碼<input type="password" autoComplete="off" className="ml-2 rounded border p-2" value={pairing} onChange={e => setPairing(e.target.value)} /></label>
      <button className={outline} onClick={() => {
        if (!/^[A-Za-z0-9_-]{40,80}$/.test(pairing.trim())) { setError('配對碼格式不正確'); return }
        localStorage.setItem(PAIRING_STORAGE_KEY, pairing.trim()); setEditing(false); setError(''); setMessage('本機配對已儲存')
      }}>儲存配對</button>
    </div>}
    {!orderNos?.length && <details open>
      <summary className="cursor-pointer text-sm font-medium">選擇待處理面單（已選 {visible.filter(r => selected.includes(r.id)).length} 筆）</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded border bg-white">
        {visible.map(row => {
          const receipt = receipts.find(r => r.order_no === row.external_order_no)
          const done = receipt?.status === 'uploaded'
          return <label key={row.id} className="flex items-start gap-3 border-b p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={selected.includes(row.id)} disabled={busy || done}
              onChange={e => setSelected(old => e.target.checked ? [...old, row.id].slice(0, 500) : old.filter(id => id !== row.id))} />
            <span><span className="font-mono">{row.external_order_no}</span><span className="ml-2 text-slate-500">{row.import_row?.[9]}</span>
              {receipt && <span className="ml-2">{done ? (receipt.verification === 'manual' ? '已上傳（人工確認）' : '已上傳') : receipt.status === 'uncertain' ? '結果待核對，請先到新比銳確認再重送' : '未完成'}</span>}
              {!!receipt?.warnings?.length && <span className="block text-amber-800">{receipt.warnings.join('；')}</span>}
            </span>
          </label>
        })}
        {!visible.length && <p className="p-3 text-sm text-slate-500">此賣場尚無已核對的 CM 訂單，請先完成轉單並記錄成功編號。</p>}
      </div>
      <button className={`${outline} mt-2`} disabled={busy} onClick={() => setSelected(visible.filter(r => {
        // 「結果待核對」的可能其實已經上傳了，不跟著批次選取，要人工確認後再單筆勾選
        const latest = receipts.find(x => x.order_no === r.external_order_no)
        return latest?.status !== 'uploaded' && latest?.status !== 'uncertain'
      }).slice(0, 500).map(r => r.id))}>選取尚未完成的面單</button>
    </details>}
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm"><input className="mr-2" type="checkbox" checked={upload} onChange={e => setUpload(e.target.checked)} />PDF 完成後上傳到新比銳</label>
      <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        disabled={busy || !pairing || (!orderNos?.length && !visible.some(r => selected.includes(r.id)))} onClick={send}>{busy ? '助手處理中…' : '送到面單助手'}</button>
      <button className={outline} disabled={busy} onClick={() => load().catch(e => setError(e.message))}>更新面單紀錄</button>
      {!!retryResult && <button className={outline} onClick={() => saveResult(retryResult)}>重試回填</button>}
    </div>
    {message && <p role="status" className="text-sm text-sky-900">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </section>
}
