'use client'
/**
 * 後台商品文案欄位：貼上自動整理 ＋ 前台排版預覽。
 *
 * 管理員多半是把 LINE、臉書寫好的文案整段貼上。這裡做兩件事：
 *   1. 貼上時清掉看不見的東西（零寬字元、行尾空白、一連串空行，見 cleanPastedText），
 *      文字內容一個字都不改
 *   2. 「看前台排版」直接用前台同一套排版顯示（標題、特色卡、條列都自動做好），
 *      不用存檔、開前台才知道長什麼樣
 * 輸入框高度跟著內容長，整段文案一眼看完，不用在小框框裡捲。
 */
import { useState } from 'react'
import { cleanPastedText } from '@/lib/productText'
import { renderProductText } from '@/lib/productBlocks'

export default function ProductTextField({ label, value, onChange, placeholder, action, minRows = 3 }: {
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  action?: React.ReactNode
  minRows?: number
}) {
  const [preview, setPreview] = useState(false)
  const rows = Math.min(18, Math.max(minRows, value.split('\n').length + 1))

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain')
    if (!pasted) return
    const cleaned = cleanPastedText(pasted)
    if (cleaned === pasted) return
    e.preventDefault()
    const el = e.currentTarget
    const next = value.slice(0, el.selectionStart) + cleaned + value.slice(el.selectionEnd)
    onChange(next)
    // 游標放到貼上內容的後面
    const pos = el.selectionStart + cleaned.length
    requestAnimationFrame(() => { try { el.setSelectionRange(pos, pos) } catch {} })
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label className="form-label mb-0">{label}</label>
        <span className="flex items-center gap-2">
          {action}
          {value.trim() && (
            <button type="button" onClick={() => setPreview(p => !p)}
              className={`rounded-lg px-2.5 py-1 text-[13px] font-bold ${preview ? 'bg-green-700 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
              {preview ? '✓ 前台排版' : '👀 看前台排版'}
            </button>
          )}
        </span>
      </div>
      <textarea className="form-input leading-relaxed" rows={rows} placeholder={placeholder ?? '直接貼上文案就好，標題、條列會自動排好'}
        value={value} onChange={e => onChange(e.target.value)} onPaste={onPaste} />
      {preview && value.trim() && (
        <div className="mt-2 rounded-xl border border-green-200 bg-white p-4">
          <p className="mb-2 text-[12px] font-bold text-green-700">客人在手機上看到的樣子</p>
          <div className="mx-auto max-w-[420px] text-[15px] leading-relaxed text-gray-700">{renderProductText(value)}</div>
        </div>
      )}
    </div>
  )
}
