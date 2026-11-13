import React from 'react'
import { parseArticle } from './articleBlocks'
import { polishProductBlocks, type ProductBlock } from './productText'

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

/**
 * 條列裡「保存方式：常溫保存」這種寫法，冒號前的標籤加粗，掃一眼就找得到。
 * 標籤限 2～8 個字，避免把一整句有冒號的話切壞。
 */
function labeled(text: string, k: string): React.ReactNode {
  const m = text.match(/^([^：:*]{2,8})[：:]\s*(.+)$/)
  if (!m) return inline(text, k)
  return <><strong className="font-bold">{m[1]}</strong><span className="opacity-50">：</span>{inline(m[2], k)}</>
}

function block(b: ProductBlock, key: number): React.ReactNode {
  const k = `pb${key}`
  switch (b.type) {
    // 商品欄位裡的「標題」是小節名（例如「每日建議量」），
    // 用稍大的粗體就夠，不需要文章那種階層。
    // 小節標題（「產品特色」「使用方式」）：左邊一條短色線，跟內文分得出層次
    case 'h2':
    case 'h3':
    case 'h4':
      return (
        <p key={k} className="mt-7 first:mt-0 flex items-center gap-2 text-[1.08em] font-bold">
          <span className="h-[1.05em] w-1 flex-shrink-0 rounded-full bg-green-600" aria-hidden />
          {inline(b.text, k)}
        </p>
      )

    // 特色卡（「01｜螺旋紋玻璃濾杯」＋底下的說明）：編號圓角標籤＋粗體小標，
    // 說明包在同一張淡底卡片裡、段落間距縮小 —— 一個重點一張卡，掃讀很快
    case 'feature':
      return (
        <div key={k} className="mt-3 first:mt-0 rounded-2xl bg-black/[0.035] px-4 py-3.5">
          <p className="flex items-start gap-2.5 font-bold leading-snug">
            <span className="mt-[0.1em] flex-shrink-0 rounded-md bg-green-700 px-1.5 py-0.5 text-[0.78em] font-bold tabular-nums text-white">{b.num}</span>
            <span className="min-w-0">{inline(b.title, k)}</span>
          </p>
          {b.body.length > 0 && (
            <div className="mt-2 text-[0.96em] leading-relaxed opacity-90 [&>*]:mt-2 [&>*:first-child]:mt-0">
              {b.body.map((x, i) => block(x, key * 100 + i + 1))}
            </div>
          )}
        </div>
      )

    // 開頭的一句話（「這款牙刷我自己用了快一年，今天終於上架了！」）：放大、底色框起來，先抓住目光。
    // 底色用半透明黑，灰色卡片、琥珀色卡片都協調
    case 'lead':
      return <p key={k} className="mt-4 first:mt-0 rounded-xl bg-black/[0.04] px-4 py-3 text-[1.08em] font-bold leading-relaxed">{inline(b.text, k)}</p>

    // 短的「材質：艾絨」這種規格行，標籤一樣加粗；長段落照原樣。
    // 段落之間留寬一點（mt-4），一小段一小段讀起來不擠
    case 'p':
      return <p key={k} className="mt-4 first:mt-0">{b.text.length <= 40 ? labeled(b.text, k) : inline(b.text, k)}</p>

    // 條列：自己畫圓點（顏色跟著外層文字色，琥珀色卡片裡也協調），
    // 項目之間留距離，長的一項折行時對齊文字而不是對齊圓點。
    case 'ul':
      return (
        <ul key={k} className="mt-3 first:mt-0 space-y-2">
          {b.items.map((item, i) => (
            <li key={`${k}-${i}`} className="flex gap-2.5">
              <span className="mt-[0.72em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-45" aria-hidden />
              <span className="min-w-0">{labeled(item, `${k}-${i}`)}</span>
            </li>
          ))}
        </ul>
      )

    // 編號：圓形數字，像步驟一樣好跟著做（使用方法最常用）
    case 'ol':
      return (
        <ol key={k} className="mt-3 first:mt-0 space-y-2.5">
          {b.items.map((item, i) => (
            <li key={`${k}-${i}`} className="flex gap-2.5">
              <span className="mt-[0.2em] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[13px] font-bold" aria-hidden>{i + 1}</span>
              <span className="min-w-0">{labeled(item, `${k}-${i}`)}</span>
            </li>
          ))}
        </ol>
      )

    case 'quote':
      // border-current 讓引用線跟著外層文字色走
      return (
        <p key={k} className="mt-3 first:mt-0 rounded-r-xl border-l-4 border-current/30 bg-black/[0.03] py-2 pl-3 pr-2">
          {inline(b.text, k)}
        </p>
      )

    case 'hr':
      return <hr key={k} className="my-4 border-t border-dashed border-current/20" />

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
  // 貼上的口語長文自動整理：導言、問句小標、符號條列、長段切小段（規則見 productText.ts）
  const blocks = polishProductBlocks(parseArticle(content))
  if (blocks.length === 0) return null
  return <>{blocks.map(block)}</>
}

/** 這個欄位有沒有可顯示的內容（只有空白或空行時為 false） */
export function hasProductText(content: string | null | undefined): boolean {
  return parseArticle(content).length > 0
}
