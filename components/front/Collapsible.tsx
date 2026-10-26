'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 內容太長時先收起來，底部漸層＋「展開」按鈕。
 *
 * 內容一直都在 HTML 裡（只是用高度裁掉），搜尋引擎照樣讀得到；
 * 短的內容量不到上限就不會出現按鈕。
 */
export default function Collapsible({ children, maxHeight = 360, moreLabel = '展開完整內容', fade = 'from-white' }: {
  children: ReactNode
  maxHeight?: number
  moreLabel?: string
  /** 漸層要接到的背景色（Tailwind from- 類別） */
  fade?: string
}) {
  const inner = useRef<HTMLDivElement>(null)
  const [tall, setTall] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const node = inner.current
    if (!node) return
    const check = () => setTall(node.scrollHeight > maxHeight + 80)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(node)
    return () => ro.disconnect()
  }, [maxHeight])

  const clipped = tall && !open
  return (
    <div>
      <div className="relative overflow-hidden" style={clipped ? { maxHeight } : undefined}>
        <div ref={inner}>{children}</div>
        {clipped && <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${fade} to-transparent`} aria-hidden />}
      </div>
      {tall && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-[15px] font-bold text-green-700 transition-colors hover:bg-green-50">
          {open ? '收起' : moreLabel}
          <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▼</span>
        </button>
      )}
    </div>
  )
}
