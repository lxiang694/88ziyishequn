import React, { Fragment } from 'react'
import Image from 'next/image'
import { parseArticle, type Block } from './articleBlocks'

// Inline parsing for **bold**
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(<strong key={`${keyPrefix}-b-${i++}`} className="font-bold text-green-800">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function renderBlock(b: Block, key: number): React.ReactNode {
  const k = `b${key}`
  switch (b.type) {
    case 'h2':
      return (
        <h2 key={k} className="text-2xl sm:text-[26px] font-bold text-gray-900 mt-10 mb-4 pb-2 border-b-2 border-green-100 leading-snug">
          {renderInline(b.text, k)}
        </h2>
      )
    case 'h3':
      return (
        <h3 key={k} className="text-xl font-bold text-green-800 mt-7 mb-3 leading-snug">
          {renderInline(b.text, k)}
        </h3>
      )
    case 'h4':
      return (
        <h4 key={k} className="text-[17px] font-bold text-gray-800 mt-6 mb-2 leading-snug">
          {renderInline(b.text, k)}
        </h4>
      )
    case 'p':
      return (
        <p key={k} className="text-gray-700 leading-loose my-5 text-[18px]">
          {renderInline(b.text, k)}
        </p>
      )
    case 'quote':
      return (
        <blockquote key={k} className="bg-amber-50 border-l-4 border-amber-400 px-5 py-4 my-6 rounded-r-xl">
          <p className="text-amber-800 leading-relaxed text-[17px]">{renderInline(b.text, k)}</p>
        </blockquote>
      )
    case 'image':
      return (
        <div key={k} className="my-6 rounded-2xl overflow-hidden bg-gray-100">
          <Image
            src={b.src}
            alt={b.alt}
            width={800}
            height={500}
            className="w-full h-auto object-cover"
            sizes="(max-width: 768px) 100vw, 700px"
          />
          {b.alt && (
            <p className="text-center text-sm text-gray-500 italic mt-2 px-3 pb-3">{b.alt}</p>
          )}
        </div>
      )
    case 'ul':
      return (
        <ul key={k} className="space-y-2 my-5 pl-1">
          {b.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-gray-700 leading-loose text-[18px]">
              <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">·</span>
              <span>{renderInline(item, `${k}-li-${i}`)}</span>
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol key={k} className="space-y-2 my-5 pl-1">
          {b.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-gray-700 leading-loose text-[18px]">
              <span className="flex-shrink-0 mt-1 w-6 h-6 rounded-full bg-green-100 text-green-800 text-[14px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{renderInline(item, `${k}-li-${i}`)}</span>
            </li>
          ))}
        </ol>
      )
    case 'hr':
      return <hr key={k} className="my-8 border-0 border-t border-gray-200" />
  }
}

/**
 * 把文章內容轉成 React。
 *
 * 斷段規則都在 lib/articleBlocks.ts，那一層是純函式且有測試 ——
 * 排版問題絕大多數是「哪裡該換段」，不是樣式。
 */
export function renderArticle(content: string): React.ReactNode {
  const blocks = parseArticle(content)
  return <Fragment>{blocks.map((b, i) => renderBlock(b, i))}</Fragment>
}
