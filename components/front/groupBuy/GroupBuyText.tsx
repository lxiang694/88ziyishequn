'use client'

import React, { useEffect, useRef, useState } from 'react'
import { parseArticle, type Block } from '@/lib/articleBlocks'
import { normalizeGroupBuyText } from '@/lib/groupBuy/text'
import { isSafeImageUrl } from '@/lib/groupBuy/textImages'

/**
 * 團購頁的文字排版（團購說明、商品介紹）。
 *
 * 後台填的內容有兩種寫法：
 *   • 團購說明：Markdown（## 標題、**粗體**、- 條列、--- 分隔、> 提醒）
 *   • 商品介紹：品牌文案常見的符號（◆ ✱ ▪ 條列、《 規格說明 》小標）
 * 原本用 whitespace-pre-line 原樣印出，客人會看到 ## 與 ** 符號，
 * 一大段灰字也很難讀。這裡沿用文章的解析（已有測試），再把品牌文案的符號
 * 轉成條列與小標，用大一點的字、寬一點的行距排出來。
 */

/** 行內粗體：用主色加粗，像在重點下畫線 */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<strong key={`${key}-${i++}`} className="font-bold text-green-900">{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** 「保存方式：常溫保存」這種條列，冒號前的標籤加粗，掃一眼就找得到 */
function labeled(text: string, key: string): React.ReactNode {
  const m = text.match(/^([^：:*]{2,8})[：:]\s*(.+)$/)
  if (!m) return inline(text, key)
  return <><span className="font-bold text-gray-900">{m[1]}</span><span className="text-gray-400">：</span>{inline(m[2], key)}</>
}

function renderBlock(b: Block, k: number, size: 'lg' | 'md'): React.ReactNode {
  const body = size === 'lg' ? 'text-[16px] leading-[1.9]' : 'text-[15px] leading-[1.8]'
  switch (b.type) {
    case 'h2':
      return (
        <h3 key={k} className="mt-7 flex items-center gap-2 text-[19px] font-bold leading-snug text-gray-900 first:mt-0">
          <span className="h-5 w-1.5 flex-shrink-0 rounded-full bg-green-600" aria-hidden />{inline(b.text, `h${k}`)}
        </h3>
      )
    case 'h3':
    case 'h4':
      return <h4 key={k} className="mt-5 text-[17px] font-bold leading-snug text-green-800 first:mt-0">{inline(b.text, `h${k}`)}</h4>
    case 'p':
      return <p key={k} className={`mt-3 text-gray-700 first:mt-0 ${body}`}>{inline(b.text, `p${k}`)}</p>
    case 'ul':
      return (
        <ul key={k} className={`mt-3 space-y-2 first:mt-0 ${body}`}>
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-gray-700">
              <span className="mt-[0.7em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-600" aria-hidden />
              <span className="min-w-0">{labeled(t, `u${k}-${i}`)}</span>
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol key={k} className={`mt-3 space-y-2 first:mt-0 ${body}`}>
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-gray-700">
              <span className="mt-[0.35em] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-[13px] font-bold text-green-800">{i + 1}</span>
              <span className="min-w-0">{inline(t, `o${k}-${i}`)}</span>
            </li>
          ))}
        </ol>
      )
    case 'quote':
      return (
        <p key={k} className="mt-4 flex gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[15px] leading-relaxed text-amber-900 first:mt-0">
          <span aria-hidden>💡</span><span>{inline(b.text, `q${k}`)}</span>
        </p>
      )
    case 'hr':
      return <hr key={k} className="my-6 border-t border-dashed border-gray-200" />
    case 'image':
      // 後台「插入圖片」放進來的圖：整張寬、圓角；只顯示 http(s) 網址
      if (!isSafeImageUrl(b.src)) return null
      return (
        <figure key={k} className="mt-4 first:mt-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.src} alt={b.alt} loading="lazy" className="mx-auto w-full max-w-xl rounded-2xl bg-gray-50" />
          {b.alt && <figcaption className="mt-1.5 text-center text-[13px] text-gray-500">{b.alt}</figcaption>}
        </figure>
      )
    default:
      return null
  }
}

export function GroupBuyText({ text, size = 'lg' }: { text: string; size?: 'lg' | 'md' }) {
  const blocks = parseArticle(normalizeGroupBuyText(text))
  if (!blocks.length) return null
  return <div>{blocks.map((b, i) => renderBlock(b, i, size))}</div>
}

/**
 * 長內容先露出一段，底下漸層淡出＋「展開」按鈕。
 * 內容本來就不長時不顯示按鈕，也不截斷。
 */
export function Collapsible({ children, collapsedHeight, moreLabel, lessLabel = '收起 ▲' }: {
  children: React.ReactNode; collapsedHeight: number; moreLabel: string; lessLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [needed, setNeeded] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (el) setNeeded(el.scrollHeight > collapsedHeight + 60)
  }, [collapsedHeight, children])

  const clipped = needed && !open
  return (
    <div>
      <div ref={ref} className="relative overflow-hidden" style={clipped ? { maxHeight: collapsedHeight } : undefined}>
        {children}
        {clipped && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-white/0" aria-hidden />}
      </div>
      {needed && (
        <button type="button" onClick={() => {
          setOpen(o => !o)
          // 收起時回到這段開頭，不然畫面會停在下面不知道跳到哪
          if (open && ref.current) window.scrollTo({ top: ref.current.getBoundingClientRect().top + window.scrollY - 140, behavior: 'instant' as ScrollBehavior })
        }}
          aria-expanded={open}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-green-600 bg-white text-[15px] font-bold text-green-700 active:bg-green-50">
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  )
}
