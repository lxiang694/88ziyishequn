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
 */
export type ProductBlock = Block | { type: 'lead'; text: string }

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

const isQuestionHeading = (t: string) =>
  t.length <= 24 && /[？?：:]$/.test(t) && !/[。！!]/.test(t) && !/[：:].+[：:]?$/.test(t.slice(0, -1))

export function polishProductBlocks(blocks: Block[]): ProductBlock[] {
  const out: ProductBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type !== 'p') { out.push(b); continue }
    const text = b.text.trim()

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
