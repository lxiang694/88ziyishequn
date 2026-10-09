'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { compressImage, MIN_BYTES_TO_COMPRESS } from '@/lib/imageCompress'

type Usage = { product_id: number; product_name: string; kind: 'cover' | 'gallery' }
type Row = {
  url: string
  usages: Usage[]
  size: number | null           // 原檔大小；null = 還沒量到或量不到
  status: 'idle' | 'working' | 'done' | 'skipped' | 'failed'
  newSize?: number
  note?: string
}

const kb = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

async function measure(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    const n = Number(r.headers.get('content-length'))
    return r.ok && n > 0 ? n : null
  } catch { return null }
}

/**
 * 既有商品圖片一鍵壓縮。
 *
 * 新上傳的圖已經會自動壓縮（lib/imageCompress.ts），這頁處理在那之前上傳的。
 * 流程全部在這個瀏覽器裡做：下載原圖 → 縮小轉 WebP → 上傳新檔 → 把商品上的
 * 網址換成新檔。原檔留在儲存空間不刪除，萬一新圖有問題還能換回來。
 */
export default function ProductImagesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const patch = (url: string, p: Partial<Row>) => setRows(rs => rs.map(r => r.url === url ? { ...r, ...p } : r))

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/products/images', { cache: 'no-store' })
    const d = await res.json()
    if (!d.success) { toast.error(d.error || '讀取失敗'); setLoading(false); return }
    const list: Row[] = d.data.map((i: any) => ({ ...i, size: null, status: 'idle' }))
    setRows(list)
    setLoading(false)
    // 量檔案大小，四個一組
    for (let i = 0; i < list.length; i += 4) {
      const sizes = await Promise.all(list.slice(i, i + 4).map(r => measure(r.url)))
      setRows(rs => rs.map(r => {
        const k = list.slice(i, i + 4).findIndex(x => x.url === r.url)
        return k >= 0 ? { ...r, size: sizes[k] } : r
      }))
    }
  }, [])

  useEffect(() => { load() }, [load])

  const targets = rows.filter(r => r.status === 'idle' && (r.size ?? 0) >= MIN_BYTES_TO_COMPRESS)
  const totalBefore = rows.reduce((s, r) => s + (r.size || 0), 0)
  const totalAfter = rows.reduce((s, r) => s + (r.status === 'done' ? r.newSize || 0 : r.size || 0), 0)

  const run = async () => {
    if (!targets.length) return
    if (!confirm(`要壓縮 ${targets.length} 張圖片嗎？\n\n原圖會保留在儲存空間，不會刪除。處理期間請不要關閉這個分頁。`)) return
    setRunning(true)
    let ok = 0
    for (const row of targets) {
      patch(row.url, { status: 'working' })
      try {
        const res = await fetch(row.url, { cache: 'no-store' })
        if (!res.ok) throw new Error('下載原圖失敗')
        const blob = await res.blob()
        const name = row.url.split('/').pop() || 'image'
        const original = new File([blob], name, { type: blob.type })
        const compressed = await compressImage(original)
        if (compressed === original) { patch(row.url, { status: 'skipped', note: '已經夠小，保留原圖' }); continue }

        const fd = new FormData()
        fd.append('file', compressed)
        const up = await (await fetch('/api/admin/upload', { method: 'POST', body: fd })).json()
        if (!up.success) throw new Error(up.error || '上傳失敗')

        const rep = await (await fetch('/api/admin/products/images', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: row.url, to: up.url }),
        })).json()
        if (!rep.success) throw new Error(rep.error || '更新商品失敗')

        patch(row.url, { status: 'done', newSize: compressed.size, note: `已更新 ${rep.updated} 處` })
        ok++
      } catch (e) {
        patch(row.url, { status: 'failed', note: e instanceof Error ? e.message : '失敗' })
      }
    }
    setRunning(false)
    toast.success(`完成：${ok} 張已壓縮`)
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">商品圖片壓縮</h1>
      <p className="mt-1 text-sm text-gray-600 leading-relaxed">
        把以前上傳的大圖縮小成 WebP，客人用手機看網站會快很多。新上傳的圖片已經會自動壓縮，這裡只處理舊圖。
        原圖保留在儲存空間，不會刪除。
      </p>

      <div className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="text-sm text-gray-700">
          {loading ? '讀取中…' : <>
            共 <b>{rows.length}</b> 張圖片，合計 <b>{kb(totalBefore)}</b>
            {totalAfter < totalBefore && <>，壓縮後 <b className="text-green-700">{kb(totalAfter)}</b></>}
            <span className="ml-2 text-gray-500">（{targets.length} 張大於 {kb(MIN_BYTES_TO_COMPRESS)}，可壓縮）</span>
          </>}
        </div>
        <button onClick={run} disabled={running || loading || !targets.length}
          className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-40">
          {running ? '壓縮中，請勿關閉分頁…' : `壓縮 ${targets.length} 張圖片`}
        </button>
      </div>

      <div className="card mt-4 divide-y divide-gray-100 overflow-hidden">
        {rows.map(r => (
          <div key={r.url} className="flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.url} alt="" loading="lazy" className="h-12 w-12 flex-shrink-0 rounded-lg bg-gray-100 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">
                {[...new Set(r.usages.map(u => u.product_name))].join('、')}
              </p>
              <p className="text-xs text-gray-500">
                {r.usages.some(u => u.kind === 'cover') ? '封面' : '相簿'}
                {r.note && <span className="ml-2">{r.note}</span>}
              </p>
            </div>
            <div className="text-right text-sm tabular-nums">
              {r.size == null ? <span className="text-gray-400">—</span>
                : r.status === 'done' && r.newSize != null
                  ? <span><span className="text-gray-400 line-through">{kb(r.size)}</span> <b className="text-green-700">{kb(r.newSize)}</b></span>
                  : <span className={r.size >= 500 * 1024 ? 'font-bold text-red-600' : 'text-gray-700'}>{kb(r.size)}</span>}
              <p className="text-xs">
                {r.status === 'working' && <span className="text-amber-600">處理中…</span>}
                {r.status === 'failed' && <span className="text-red-600">失敗</span>}
              </p>
            </div>
          </div>
        ))}
        {!loading && !rows.length && <p className="p-6 text-center text-gray-500">沒有商品圖片</p>}
      </div>
    </div>
  )
}
