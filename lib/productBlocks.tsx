import React from 'react'
import { parseArticle, type Block } from './articleBlocks'

/**
 * 商品描述欄位的排版（適合誰 / 使用方法 / 成分說明 / 注意事項 / 怎麼搭…）。
 *
 * ── 為什麼不直接用 whitespace-pre-line ──────────────────
 * 原本這些欄位是這樣渲染的：
 *   <p className="... whitespace-pre-line">{product.suitable_people}</p>
 *
 * 那只保留換行，沒有任何結構。後台輸入的「•」會變成一段文字裡的符號，
 * 條列不會縮排、項目之間沒有間距，整塊看起來就是一面牆。內容多一點的
 * 商品（例如綜合維生素的適合誰、成分說明）在手機上特別難讀。
 *
 * ── 為什麼不直接用文章的 renderArticle ─────────────────
 * 文章那套是為整頁長文設計的：h2 有 26px、上方 40px 間距、底線分隔。
 * 放進商品卡片裡會比卡片標題還大。而且它的粗體寫死 text-green-800，
 * 放進琥珀色的「注意事項」卡片會撞色。
 *
 * 所以這裡共用 parseArticle 的解析（條列、編號、段落判斷都已經測過），
 * 但自己做一套精簡、**不指定顏色**的樣式 —— 文字顏色由外層卡片決定，
 * 同一個函式才能同時用在灰色卡片與琥珀色卡片上。
 */

/** 行內粗體。刻意不指定顏色，沿用外層的文字色。 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(<strong key={`${keyPrefix}-b-${i++}`} className="font-bold">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function block(b: Block, key: number): React.ReactNode {
  const k = `pb${key}`
  switch (b.type) {
    // 商品欄位裡的「標題」是小節名（例如「每日建議量」），
    // 用稍大的粗體就夠，不需要文章那種階層。
    case 'h2':
    case 'h3':
    case 'h4':
      return <p key={k} className="mt-3 first:mt-0 font-bold">{inline(b.text, k)}</p>

    case 'p':
      return <p key={k} className="mt-2 first:mt-0">{inline(b.text, k)}</p>

    case 'ul':
      return (
        <ul key={k} className="mt-2 first:mt-0 ml-[1.1em] list-disc space-y-1.5 marker:opacity-60">
          {b.items.map((item, i) => <li key={`${k}-${i}`} className="pl-0.5">{inline(item, `${k}-${i}`)}</li>)}
        </ul>
      )

    case 'ol':
      return (
        <ol key={k} className="mt-2 first:mt-0 ml-[1.4em] list-decimal space-y-1.5 marker:font-semibold marker:opacity-70">
          {b.items.map((item, i) => <li key={`${k}-${i}`} className="pl-0.5">{inline(item, `${k}-${i}`)}</li>)}
        </ol>
      )

    case 'quote':
      // border-current 讓引用線跟著外層文字色走
      return (
        <p key={k} className="mt-2 first:mt-0 border-l-2 border-current/30 pl-3 opacity-90">
          {inline(b.text, k)}
        </p>
      )

    case 'hr':
      return <hr key={k} className="my-3 border-t border-current/15" />

    // 商品欄位不放圖片。這些欄位是規格與說明，圖片走商品相簿；
    // 真的貼了 markdown 圖片語法就當成沒有，不要硬塞一張破圖。
    case 'image':
      return null

    default:
      return null
  }
}

/**
 * 把一段商品描述文字渲染成有結構的區塊。
 *
 * 回傳 null 代表沒有內容 —— 呼叫端本來就會用 `{field && ...}` 判斷，
 * 但空白字串或只有空行的欄位也該當成沒有內容。
 */
export function renderProductText(content: string | null | undefined): React.ReactNode {
  const blocks = parseArticle(content)
  if (blocks.length === 0) return null
  return <>{blocks.map(block)}</>
}

/** 這個欄位有沒有可顯示的內容（只有空白或空行時為 false） */
export function hasProductText(content: string | null | undefined): boolean {
  return parseArticle(content).length > 0
}
