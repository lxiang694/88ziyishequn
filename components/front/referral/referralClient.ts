'use client'
import { normalizeCode, readStoredRef, REF_PARAM, REF_STORAGE_KEY } from '@/lib/referral'

/** 瀏覽器裡記著的朋友推薦碼（30 天內有效）；下單時一起送出 */
export function getStoredRef(): string | null {
  try { return readStoredRef(localStorage.getItem(REF_STORAGE_KEY)) } catch { return null }
}

/** 網址上有 ?ref= 就記下來（覆蓋舊的：以最近一次點的連結為準） */
export function captureRefFromUrl(): string | null {
  try {
    const code = normalizeCode(new URLSearchParams(window.location.search).get(REF_PARAM))
    if (code) localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ code, at: Date.now() }))
    return code
  } catch { return null }
}

/** LINE 分享網址：手機會直接打開 LINE 選聊天室 */
export const lineShareUrl = (text: string) => `https://line.me/R/msg/text/?${encodeURIComponent(text)}`

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
    const t = document.createElement('textarea')
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t)
    return true
  } catch { return false }
}
