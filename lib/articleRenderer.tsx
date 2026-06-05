import React, { Fragment } from 'react'
import Image from 'next/image'

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

// Convert simple markdown to React. Supports: ## ### > - ![]() **bold** + paragraphs
export function renderArticle(content: string): React.ReactNode {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let listBuffer: string[] = []
  let paraBuffer: string[] = []
  let key = 0

  const flushList = () => {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={`l${key++}`} className="space-y-2 my-5 pl-1">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-3 text-gray-700 leading-loose text-[18px]">
            <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">·</span>
            <span>{renderInline(item, `li-${i}`)}</span>
          </li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  const flushPara = () => {
    if (paraBuffer.length === 0) return
    const text = paraBuffer.join(' ')
    blocks.push(
      <p key={`p${key++}`} className="text-gray-700 leading-loose my-5 text-[18px]">
        {renderInline(text, `p-${key}`)}
      </p>
    )
    paraBuffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      flushList()
      flushPara()
      continue
    }

    // h2: ##
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      flushList(); flushPara()
      blocks.push(
        <h2 key={`h${key++}`} className="text-2xl sm:text-[26px] font-bold text-gray-900 mt-10 mb-4 pb-2 border-b-2 border-green-100 leading-snug">
          {renderInline(trimmed.slice(3), `h2-${key}`)}
        </h2>
      )
      continue
    }
    // h3: ###
    if (trimmed.startsWith('### ')) {
      flushList(); flushPara()
      blocks.push(
        <h3 key={`h${key++}`} className="text-xl font-bold text-green-800 mt-7 mb-3 leading-snug">
          {renderInline(trimmed.slice(4), `h3-${key}`)}
        </h3>
      )
      continue
    }
    // blockquote: >
    if (trimmed.startsWith('> ')) {
      flushList(); flushPara()
      blocks.push(
        <blockquote key={`bq${key++}`} className="bg-amber-50 border-l-4 border-amber-400 px-5 py-4 my-6 rounded-r-xl">
          <p className="text-amber-800 leading-relaxed text-[17px]">{renderInline(trimmed.slice(2), `bq-${key}`)}</p>
        </blockquote>
      )
      continue
    }
    // image: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/)
    if (imgMatch) {
      flushList(); flushPara()
      blocks.push(
        <div key={`img${key++}`} className="my-6 rounded-2xl overflow-hidden bg-gray-100">
          <Image
            src={imgMatch[2]}
            alt={imgMatch[1] || ''}
            width={800}
            height={500}
            className="w-full h-auto object-cover"
            sizes="(max-width: 768px) 100vw, 700px"
          />
          {imgMatch[1] && (
            <p className="text-center text-sm text-gray-500 italic mt-2 px-3 pb-3">{imgMatch[1]}</p>
          )}
        </div>
      )
      continue
    }
    // unordered list: -
    if (trimmed.startsWith('- ')) {
      flushPara()
      listBuffer.push(trimmed.slice(2))
      continue
    }

    // paragraph
    flushList()
    paraBuffer.push(trimmed)
  }
  flushList()
  flushPara()

  return <Fragment>{blocks}</Fragment>
}
