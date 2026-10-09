'use client'

/**
 * 首頁橫幅設定。
 *
 * 取代原本寫死的「四步驟完成購物」區塊。關掉或還沒上傳時，首頁會自動
 * 用回那個區塊，不會開天窗。
 *
 * 預覽框刻意就是 16:9 ＋ object-cover，跟前台完全一樣 —— 讓使用者在
 * 存檔前就看到會被裁掉哪裡，而不是上線後才發現字被切掉。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { compressImage } from '@/lib/imageCompress'
import toast from 'react-hot-toast'
import {
  checkAspect, checkResolution, isSafeLinkPath,
  RECOMMENDED_WIDTH, RECOMMENDED_HEIGHT,
} from '@/lib/homeBanner'

const button = 'rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-green-800'
const outline = 'rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50 disabled:opacity-40'

export default function HomeBannerPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [altText, setAltText] = useState('')
  const [linkPath, setLinkPath] = useState('')
  const [isActive, setIsActive] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [imageNote, setImageNote] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/home-banner', { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok || !d.success) throw new Error(d.error || '讀取失敗')
      setImageUrl(d.data.image_url)
      setAltText(d.data.alt_text || '')
      setLinkPath(d.data.link_path || '')
      setIsActive(!!d.data.is_active)
    } catch (e) {
      setError(e instanceof Error ? e.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** 先在瀏覽器讀出尺寸給提醒，再上傳 —— 比例不對的話，使用者可以當場換一張 */
  const measure = (file: File) => new Promise<{ width: number; height: number }>(resolve => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }) }
    img.src = url
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError(''); setImageNote('')
    try {
      const { width, height } = await measure(file)
      const aspect = checkAspect(width, height)
      const res = checkResolution(width)
      setImageNote([aspect.ok ? '' : aspect.message, res].filter(Boolean).join(' '))

      // 解析度檢查用原檔；上傳的是壓縮版。橫幅是滿版大圖，長邊留到 1920
      const fd = new FormData()
      fd.append('file', await compressImage(file, 1920))
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '上傳失敗')
      setImageUrl(d.url)
      toast.success('圖片已上傳，記得按儲存')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上傳失敗'
      setError(msg); toast.error(msg)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const linkInvalid = linkPath.trim().length > 0 && !isSafeLinkPath(linkPath.trim())
  const canActivate = !!imageUrl && altText.trim().length > 0

  const save = async () => {
    if (linkInvalid) { toast.error('連結格式不正確'); return }
    if (isActive && !canActivate) { toast.error('要開啟橫幅，圖片與圖片說明都必須填寫'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/admin/home-banner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl, alt_text: altText, link_path: linkPath, is_active: isActive,
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.error || '儲存失敗')
      toast.success(isActive ? '已儲存，首頁現在顯示這張橫幅' : '已儲存，首頁顯示原本的四步驟區塊')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '儲存失敗'
      setError(msg); toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-bold text-gray-800">首頁橫幅</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          顯示在首頁搜尋列下方，取代原本的「四步驟完成購物」。
          關掉或還沒上傳圖片時，首頁會自動用回那個區塊，不會開天窗。
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">讀取中…</p>
      ) : (
        <>
          {/* ── 圖片 ── */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold text-gray-800">圖片</h2>
            <p className="mt-1 text-sm text-gray-500">
              建議 {RECOMMENDED_WIDTH}×{RECOMMENDED_HEIGHT}（16:9）、5MB 以內。
              比例不同不會破版，但會被裁掉邊。
            </p>

            {/* 預覽框就是前台的樣子：16:9 ＋ object-cover */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
              <div className="relative aspect-[16/9] w-full">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="橫幅預覽" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
                    <span className="text-3xl">🖼️</span>
                    <span className="text-sm">尚未上傳圖片</span>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              ↑ 這就是首頁實際的顯示範圍。超出框外的部分會被裁掉。
            </p>

            {imageNote && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-800">
                {imageNote}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input ref={fileInput} type="file" accept="image/*" onChange={handleUpload}
                disabled={uploading}
                className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
              {uploading && <span className="text-sm text-gray-500">上傳中…</span>}
              {imageUrl && !uploading && (
                <button className={outline}
                  onClick={() => { setImageUrl(null); setIsActive(false); setImageNote('') }}>
                  移除圖片
                </button>
              )}
            </div>
          </section>

          {/* ── 文字說明與連結 ── */}
          <section className="space-y-4 rounded-xl border bg-white p-5">
            <div>
              <label className="block font-semibold text-gray-800" htmlFor="alt">
                圖片說明<span className="ml-1 text-red-600">*</span>
              </label>
              <p className="mt-1 text-sm text-gray-500">
                圖片上寫了什麼，就照著打一次。看不到圖的人（讀屏軟體、圖片載入失敗）
                和搜尋引擎只能讀到這段字。
              </p>
              <input id="alt" value={altText} maxLength={200}
                onChange={e => setAltText(e.target.value)}
                placeholder="例：四步驟完成購物 —— 選商品、選規格、填資料、選 7-11 門市取貨"
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm" />
            </div>

            <div>
              <label className="block font-semibold text-gray-800" htmlFor="link">
                點擊後前往（選填）
              </label>
              <p className="mt-1 text-sm text-gray-500">
                站內路徑，以 / 開頭，例如 <code className="rounded bg-gray-100 px-1">/shop</code>。
                留空的話圖片就只是圖片，不可點。
              </p>
              <input id="link" value={linkPath}
                onChange={e => setLinkPath(e.target.value)}
                placeholder="/shop"
                className={`mt-2 w-full rounded-lg border p-3 text-sm ${linkInvalid ? 'border-red-400' : 'border-gray-300'}`} />
              {linkInvalid && (
                <p className="mt-1 text-sm text-red-700">
                  必須是站內路徑（以 / 開頭），而且不可帶 ? 或 #
                </p>
              )}
            </div>
          </section>

          {/* ── 開關 ── */}
          <section className="rounded-xl border bg-white p-5">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={isActive} disabled={!canActivate}
                onChange={e => setIsActive(e.target.checked)} className="mt-1" />
              <span>
                <span className="font-semibold text-gray-800">在首頁顯示這張橫幅</span>
                <span className="mt-1 block text-sm text-gray-500">
                  {canActivate
                    ? '打開之後，首頁的「四步驟完成購物」會換成這張圖。'
                    : '要先上傳圖片並填寫圖片說明，才能打開。'}
                </span>
              </span>
            </label>
          </section>

          <div className="flex flex-wrap gap-3">
            <button className={button} disabled={saving || linkInvalid} onClick={save}>
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button className={outline} disabled={saving} onClick={load}>還原未儲存的變更</button>
          </div>
        </>
      )}
    </div>
  )
}
