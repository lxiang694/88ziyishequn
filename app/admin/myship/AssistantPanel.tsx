'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAssistantStatus, type AssistantStatus } from '@/lib/myship/assistantProtocol'
const CHANNEL = 'health-myship-assistant-v1'

function request(type: string, payload = {}, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const finish = () => { window.removeEventListener('message', receive); clearTimeout(timer) }
    const receive = (event: MessageEvent) => {
      const m = event.data
      if (event.source !== window || event.origin !== location.origin || m?.channel !== CHANNEL || m.direction !== 'response' || m.id !== id) return
      finish()
      if (m.ok === true) resolve(m.data)
      else reject(new Error(typeof m.error === 'string' && m.error ? m.error : '助手已載入，但背景程式沒有有效回覆。請更新助手並重新開啟此比特瀏覽器環境，再重新整理頁面。'))
    }
    const timer = setTimeout(() => { finish(); reject(new Error('此頁面尚未連接助手。請確認這個比特瀏覽器環境已啟用助手，並按 Ctrl＋F5 重新整理。')) }, timeout)
    window.addEventListener('message', receive)
    window.postMessage({ channel: CHANNEL, direction: 'request', id, type, ...payload }, location.origin)
  })
}

export default function AssistantPanel({ selected, market, disabled, onChange }: { selected: number[]; market: string; disabled: boolean; onChange: () => Promise<void> }) {
  const [status, setStatus] = useState<AssistantStatus | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const last = useRef(''), onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const refresh = useCallback(async () => {
    let next: AssistantStatus
    try {
      next = parseAssistantStatus(await request('status'))
      setStatus(next); setConnectionError('')
    } catch (e) {
      setStatus(null); setConnectionError(e instanceof Error ? e.message : '助手連線中斷，請重新整理頁面')
      throw e
    }
    const terminal = next.job && ['complete', 'attention', 'paused'].includes(next.job.phase) ? `${next.job.batch_id}:${next.job.phase}` : ''
    if (terminal && terminal !== last.current) { last.current = terminal; await onChangeRef.current() }
  }, [])
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      await refresh().catch(() => {})
      if (!stopped) timer = setTimeout(poll, 5000)
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [refresh])
  const run = async (type: 'start' | 'recover' | 'pause') => {
    setBusy(true); setError('')
    try { await request(type, { order_ids: selected, marketplace_id: market }, 240000); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '助手處理中斷'); await refresh().catch(() => {}) }
    finally { setBusy(false); await onChangeRef.current().catch(() => {}) }
  }
  const version = status?.version.split('.').map(Number) || [0, 0, 0]
  const canPause = version[0] > 0 || version[1] > 2 || (version[1] === 2 && version[2] >= 4)
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5" aria-label="瀏覽器自動轉單助手">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">比特瀏覽器自動轉單助手</h2><p className="mt-1 text-sm text-slate-600">{status ? `助手 ${status.version} 已連接。${status.pilot ? '可傳送所選訂單並核對結果。' : '首次請選1筆驗收，成功後即可批次處理。'}` : '首次安裝助手，並在同一個瀏覽器環境登入健康優選及賣貨便。'}</p></div><a href="/downloads/myship-assistant-0.2.5.zip" className="text-sm font-medium underline">下載助手 0.2.5 及安裝說明</a></div>
    {status?.job && <p role="status" className="text-sm">{status.job.message}</p>}
    {status?.job && !['complete', 'paused'].includes(status.job.phase) && <p className="text-sm text-amber-800">上一批尚待核對，請讀回結果；若要先處理其他訂單，請按「保留此批，繼續其他訂單」。</p>}
    {(connectionError || error) && <p role="alert" className="text-sm text-red-700">{connectionError || error}</p>}
    <div className="flex flex-wrap gap-2">
      <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={!status || busy || disabled || !selected.length || (!status.pilot && selected.length !== 1) || (!!status.job && !['complete', 'paused'].includes(status.job.phase))} onClick={() => run('start')}>{busy ? '助手處理中…' : '自動轉到賣貨便'}</button>
      {status?.job && status.job.phase !== 'complete' && <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40" disabled={busy || disabled} onClick={() => run('recover')}>讀回上一批結果</button>}
      {status?.job?.phase === 'attention' && (canPause ? <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40" disabled={busy || disabled} onClick={() => run('pause')}>保留此批，繼續其他訂單</button> : <p className="text-sm text-amber-800">更新助手至0.2.5後，可保留異常批次並繼續其他訂單。</p>)}
      {!status && <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => refresh().then(() => setError('')).catch(e => setError(e.message))}>檢查助手連線</button>}
    </div>
  </section>
}
