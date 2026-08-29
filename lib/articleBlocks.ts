/**
 * 文章內容解析 —— 純函式，不含 React，可單元測試。
 *
 * 為什麼需要這一層：
 * 後台編輯器是一個純 textarea，內容通常是從 Word、Google 文件、
 * LINE 或 AI 產生的結果直接貼進來的。那些來源不會有標準 Markdown 的
 * 「段落之間空一行」慣例 —— 作者只是按了一次 Enter。
 *
 * 舊版只在遇到空行時才切段，結果整篇文章被 join(' ') 黏成一大塊，
 * 而且中文之間還多出空格。這裡把「怎麼斷段」變成明確、可測試的規則。
 */

export type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'h4'; text: string }
  | { type: 'p'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' }

/** 句子結束的標點。用來判斷單一換行到底是換段還是只是折行。 */
const SENTENCE_END = /[。！？…；!?;]["'」』）\)】》]*$/

/** 中日韓文字：這些字之間接起來不該有空格 */
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/

/**
 * 把同一段裡被折行的內容接起來。
 *
 * 中文之間直接相接；只有兩邊都是英數字時才補一個空格，
 * 否則「保健 食品」會憑空多出空格。
 */
export function joinWrapped(lines: readonly string[]): string {
  return lines.reduce((acc, line, i) => {
    if (i === 0) return line
    const prev = acc.slice(-1)
    const next = line.slice(0, 1)
    const needSpace = /[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next)
    return acc + (needSpace ? ' ' : '') + line
  }, '')
}

/** 條列符號：涵蓋 Word、LINE 與各種輸入法會產生的樣式 */
const BULLET = /^[-*+•‧·・◦▪▫※o]\s+/
/** 編號條列：1. / 1) / (1) / １． / ① */
const ORDERED = /^(?:[（(]?\d{1,3}[.)、．][）)]?|[①-⑳])\s*/
/** 中文章節標題：一、／（一）／第一章 */
const CJK_SECTION = /^(?:第?[一二三四五六七八九十百]+[、.．)）章節篇]|[（(][一二三四五六七八九十]+[）)])\s*/

/**
 * 一行是否應該當成標題。
 *
 * 從外部貼進來的內容常常用「整行粗體」或「中文章節序號」當標題，
 * 而不是 Markdown 的 ##。把這些認出來，排版才會有層次。
 */
function detectHeading(line: string): { level: 'h2' | 'h3'; text: string } | null {
  // 整行都是粗體，且不長 → 標題
  const allBold = line.match(/^\*\*(.+)\*\*[：:]?$/)
  if (allBold && allBold[1].length <= 40 && !SENTENCE_END.test(allBold[1])) {
    return { level: 'h3', text: allBold[1].trim() }
  }
  // 中文章節序號開頭，且整行不長、結尾不是句號 → 標題
  if (CJK_SECTION.test(line) && line.length <= 40 && !SENTENCE_END.test(line)) {
    return { level: 'h2', text: line.trim() }
  }
  return null
}

/**
 * 決定單一換行是換段還是折行。
 *
 * 只有在整篇都沒有空行時（作者用 Enter 分段），才需要靠這個判斷。
 */
function isParagraphBreak(prevLine: string, nextLine: string): boolean {
  // 上一行以句號等收尾 → 是完整的一段
  if (SENTENCE_END.test(prevLine)) return true
  // 下一行是條列、標題、引用、圖片 → 一定要切開
  if (BULLET.test(nextLine) || ORDERED.test(nextLine)) return true
  if (/^#{1,6}\s/.test(nextLine) || nextLine.startsWith('> ')) return true
  if (/^!\[/.test(nextLine)) return true
  // 上一行很短（不像被折行的內文）→ 多半是獨立的一行
  if (prevLine.length <= 20) return true
  return false
}

export function parseArticle(content: string | null | undefined): Block[] {
  if (!content) return []

  // 統一換行；全形空白轉半形以免影響 trim
  const raw = content.replace(/\r\n?/g, '\n').replace(/ /g, ' ')
  const lines = raw.split('\n')

  // 整篇有沒有空行？沒有的話，作者是用單次 Enter 分段的。
  const hasBlankLine = /\n[ \t]*\n/.test(raw)

  const blocks: Block[] = []
  let para: string[] = []
  let ul: string[] = []
  let ol: string[] = []

  const flushPara = () => {
    if (para.length === 0) return
    const text = joinWrapped(para).trim()
    para = []
    if (!text) return
    const heading = detectHeading(text)
    if (heading) blocks.push({ type: heading.level, text: heading.text })
    else blocks.push({ type: 'p', text })
  }
  const flushUl = () => {
    if (ul.length === 0) return
    blocks.push({ type: 'ul', items: ul }); ul = []
  }
  const flushOl = () => {
    if (ol.length === 0) return
    blocks.push({ type: 'ol', items: ol }); ol = []
  }
  const flushAll = () => { flushPara(); flushUl(); flushOl() }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line === '') { flushAll(); continue }

    // ── 分隔線 ──
    if (/^([-*_])\1{2,}$/.test(line)) {
      flushAll(); blocks.push({ type: 'hr' }); continue
    }

    // ── Markdown 標題（# 到 ####）──
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushAll()
      const level = h[1].length
      // # 與 ## 都當 h2：文章本身的標題已經是 h1 了
      const type = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
      blocks.push({ type, text: h[2].trim() } as Block)
      continue
    }

    // ── 引用 ──
    if (line.startsWith('>')) {
      flushAll()
      blocks.push({ type: 'quote', text: line.replace(/^>\s?/, '').trim() })
      continue
    }

    // ── 圖片 ──
    const img = line.match(/^!\[(.*?)\]\((.+?)\)$/)
    if (img) {
      flushAll()
      blocks.push({ type: 'image', alt: img[1] || '', src: img[2] })
      continue
    }

    // ── 編號條列 ──
    if (ORDERED.test(line)) {
      flushPara(); flushUl()
      ol.push(line.replace(ORDERED, '').trim())
      continue
    }

    // ── 符號條列 ──
    if (BULLET.test(line)) {
      flushPara(); flushOl()
      ul.push(line.replace(BULLET, '').trim())
      continue
    }

    // ── 內文 ──
    flushUl(); flushOl()

    if (para.length > 0) {
      // 有空行的文章照 Markdown 慣例：空行才換段，這裡是折行
      // 沒有空行的文章：靠標點與長度判斷這是新的一段還是折行
      const breakHere = !hasBlankLine && isParagraphBreak(para[para.length - 1], line)
      if (breakHere) flushPara()
    }
    para.push(line)
  }

  flushAll()
  return blocks
}
