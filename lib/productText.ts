import type { Block } from './articleBlocks'

/**
 * 商品文案的自動排版（純函式，可測試）。
 *
 * 後台多半是把 LINE、臉書寫好的文案整段貼上：一段一段的口語長文，沒有標題、沒有條列。
 * 照原樣排出來在手機上就是一面字牆。這裡在 parseArticle 之後再整理一次，
 * 規則刻意保守（寧可不改，也不要改錯）：
 *
 *   1. 開頭第一句是短句（≤60 字，以！結尾或 emoji 開頭）→ 當「導言」放大強調
 *   2. 短句以？或：結尾（≤24 字，例如「為什麼推薦這款？」「使用方式：」）→ 小標題
 *   3. 連續兩行以上用 ✅ 👉 ✔ ★ ◆ 這類符號開頭 → 條列
 *   4. 超過 75 字的長段落（手機上 4 行以上）→ 依句號切成幾小段（每段約 40 字以上才切）
 *   5. 「01｜螺旋紋玻璃濾杯」這種編號小標 → 特色卡：小標＋底下的說明包成一張卡
 *   6. 單獨一行、沒有標點的短句（2～12 字，例如「產品特色」「使用方式」），
 *      後面還有內容 → 小節標題
 *   7. 連續三行以上沒有標點的短句（例如「長時間用電腦的人」「肩頸緊繃的人」）→ 條列
 *      （只有一兩行的不動，免得把普通的短句當成清單）
 */
export type ProductBlock =
  | Block
  | { type: 'lead'; text: string }
  | { type: 'feature'; num: string; title: string; body: ProductBlock[] }

const EMOJI_START = /^(\p{Extended_Pictographic}|[✅✔☑✓➤►▶▪▫◆◇★☆●○■□])️?\s*/u
const SENTENCE = /[^。！？!?]+[。！？!?]+[」』）)]*|[^。！？!?]+$/g

/** 長段落依句子切成幾段；每段累積到約 40 字才斷，不會切得太碎 */
export function splitLongParagraph(text: string, max = 75, target = 40): string[] {
  if (text.length <= max) return [text]
  const sentences = text.match(SENTENCE)?.map(s => s.trim()).filter(Boolean) || [text]
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    cur += s
    if (cur.length >= target) { out.push(cur); cur = '' }
  }
  if (cur) {
    // 最後剩一小句就併回上一段，不要孤零零一行
    if (out.length && cur.length < 20) out[out.length - 1] += cur
    else out.push(cur)
  }
  return out
}

/** 「01｜標題」「1 | 標題」「02丨標題」：編號＋直線＋短標題，沒有句子標點 */
const FEATURE = /^(\d{1,2})\s*[｜|丨│]\s*(.{2,24})$/
const isFeatureHeading = (t: string) => FEATURE.test(t) && !/[。！？!?，,]/.test(t)

/** 沒有任何標點的短句（2～12 字）：可能是小節標題，或清單裡的一項 */
const PUNCT = /[。！？!?，,、；;：:「」『』（）()…～~]/
const isBareShort = (t: string) => {
  const n = Array.from(t).length
  return n >= 2 && n <= 12 && !PUNCT.test(t) && !EMOJI_START.test(t) && !FEATURE.test(t)
}

/**
 * 一看就是小節名的短句（「適合誰」「使用方式」「產品特色」「注意事項」…）。
 * 這些就算後面接的是一串短句，也是標題、不是清單的第一項。
 */
const SECTION_WORD = /(特色|特點|亮點|重點|優點|介紹|說明|適合誰|適合對象|適用對象|推薦給|使用方式|使用方法|食用方式|食用方法|建議用法|用法|成分|規格|內容物|注意事項|保存方式|保存|產地|來源|推薦理由|為什麼推薦|小提醒|常見問題)$/
const isSectionTitle = (t: string) => isBareShort(t) && Array.from(t).length <= 8 && SECTION_WORD.test(t)

const isQuestionHeading = (t: string) =>
  t.length <= 24 && /[？?：:]$/.test(t) && !/[。！!]/.test(t) && !/[：:].+[：:]?$/.test(t.slice(0, -1))

export function polishProductBlocks(blocks: Block[]): ProductBlock[] {
  // 先做一般的整理，再把「01｜小標」與它底下的內容包成特色卡
  return groupFeatures(polishBasic(blocks))
}

function groupFeatures(blocks: ProductBlock[]): ProductBlock[] {
  const out: ProductBlock[] = []
  let card: Extract<ProductBlock, { type: 'feature' }> | null = null
  for (const b of blocks) {
    const text = (b.type === 'p' || b.type === 'h3' || b.type === 'h2' || b.type === 'h4') ? b.text.trim() : ''
    const m = b.type === 'p' && isFeatureHeading(text) ? text.match(FEATURE) : null
    if (m) {
      card = { type: 'feature', num: m[1].padStart(2, '0'), title: m[2].trim(), body: [] }
      out.push(card)
      continue
    }
    // 小節標題、導言出現就結束目前的特色卡
    if (card && (b.type === 'h2' || b.type === 'h3' || b.type === 'h4' || b.type === 'lead' || b.type === 'hr')) card = null
    if (card) card.body.push(b)
    else out.push(b)
  }
  return out
}

function polishBasic(blocks: Block[]): ProductBlock[] {
  const out: ProductBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type !== 'p') { out.push(b); continue }
    const text = b.text.trim()

    // 5. 編號小標：先原樣留著，groupFeatures 會把它和底下的內容包成卡
    if (isFeatureHeading(text)) { out.push({ type: 'p', text }); continue }

    // 6a. 明顯是小節名的短句（適合誰、使用方式…），後面還有內容 → 小節標題
    if (isSectionTitle(text) && i < blocks.length - 1) { out.push({ type: 'h3', text }); continue }

    // 7. 連續三行以上沒有標點的短句 → 條列（小節名不算進清單）
    if (isBareShort(text)) {
      let j = i
      while (j < blocks.length && blocks[j].type === 'p' && isBareShort((blocks[j] as { text: string }).text.trim()) && !isSectionTitle((blocks[j] as { text: string }).text.trim())) j++
      if (j - i >= 3) {
        out.push({ type: 'ul', items: blocks.slice(i, j).map(x => (x as { text: string }).text.trim()) })
        i = j - 1
        continue
      }
      // 6. 單獨一行的短句，後面還有內容 → 小節標題
      if (j - i === 1 && i < blocks.length - 1) { out.push({ type: 'h3', text }); continue }
    }

    // 1. 導言
    const next = blocks[i + 1]
    const listFollows = EMOJI_START.test(text) && next?.type === 'p' && EMOJI_START.test(next.text.trim())
    if (out.length === 0 && i === 0 && text.length <= 60 && (/[！!]$/.test(text) || EMOJI_START.test(text)) && blocks.length > 1 && !listFollows) {
      out.push({ type: 'lead', text })
      continue
    }

    // 3. 連續的符號開頭行 → 條列
    if (EMOJI_START.test(text) && text.replace(EMOJI_START, '').length > 0) {
      const run: string[] = []
      let j = i
      while (j < blocks.length && blocks[j].type === 'p' && EMOJI_START.test((blocks[j] as { text: string }).text.trim())) {
        run.push((blocks[j] as { text: string }).text.trim().replace(EMOJI_START, ''))
        j++
      }
      if (run.length >= 2) { out.push({ type: 'ul', items: run }); i = j - 1; continue }
    }

    // 2. 問句／冒號結尾的短句 → 小標題（後面要還有內容）
    if (isQuestionHeading(text) && i < blocks.length - 1) {
      out.push({ type: 'h3', text: text.replace(/[：:]$/, '') })
      continue
    }

    // 4. 長段落切小段
    for (const part of splitLongParagraph(text)) out.push({ type: 'p', text: part })
  }
  return out
}

/**
 * 後台貼上文案時的清理（純函式）。
 *
 * 從 LINE、臉書、Word、網頁複製的文字常夾帶：看不見的零寬字元、行尾空白、
 * 全形空白縮排、一連串好幾個空行。這些在前台會變成奇怪的空隙或對不齊。
 * 這裡只清「看不見的東西」，不改任何文字內容；分段、標題、條列交給前台自動排版。
 */
export function cleanPastedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿⁠]/g, '')       // 零寬字元
    .replace(/[ 　]/g, ' ')                    // 不換行空白、全形空白
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')                         // 好幾個空行 → 一個
    .trim()
}
