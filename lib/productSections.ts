/**
 * 商品介紹「整篇貼上」的分區（純函式，可測試）。
 *
 * 後台只有一個「商品介紹」欄位，管理員把整篇文案貼進來，例如：
 *
 *   商品重點 / 產品特色 / 適合誰 / 使用方法 / 搭配建議 / 成分規格 / 注意事項 / 保存方式
 *
 * 這裡依小標題把內容切成幾區，每區知道自己是什麼（kind），前台再用各自的樣式排：
 * 重點是深綠摘要、注意事項是琥珀色框、規格排成表格……
 *
 * 小標題的寫法很寬鬆，下面這些都認得：
 *   適合誰 / 適合誰： / 【適合誰】 / ■ 適合誰 / ✅適合誰 / 1. 適合誰 / 一、適合誰 / ## 適合誰
 * 但一定是「單獨一行、短、沒有句子標點」才算，免得把內文的一句話當成標題。
 */

export type SectionKind =
  | 'intro' | 'summary' | 'features' | 'who' | 'usage' | 'pairing'
  | 'spec' | 'caution' | 'storage' | 'source' | 'other'

export interface Section { kind: SectionKind; title: string; body: string }

/**
 * 小標題文字 → 哪一種區塊。關鍵字要在「結尾」才算 —— 「使用方法」「注意事項」是標題，
 * 「開封後請盡快食用完畢」只是剛好有「食用」兩個字的一句話。
 * 順序有意義：「使用注意事項」要先被認成注意事項。
 */
const KIND_RULES: [SectionKind, RegExp][] = [
  ['caution', /(注意事項|注意|警語|禁忌|警告)$/],
  ['storage', /(保存方式|保存方法|保存|存放方式|存放|保存期限|有效期限)$/],
  ['pairing', /(搭配建議|搭配方式|搭配|怎麼搭)$/],
  ['usage', /(使用方法|使用方式|使用說明|使用步驟|食用方法|食用方式|建議用法|用法|吃法|怎麼吃|怎麼用|服用方式|服用方法|沖泡方式|沖泡方法|步驟)$/],
  ['spec', /(成分規格|成分說明|成分|規格說明|產品規格|商品規格|規格|內容物|營養標示|容量|材質|產品資訊|商品資訊|尺寸)$/],
  ['who', /(適合誰|誰適合|適合對象|適用對象|適合族群|適合的人|推薦給)$/],
  ['features', /(特色|特點|亮點|優點|賣點|好處)$/],
  ['summary', /(重點|摘要|總結)$/],
  ['source', /(來源|產地|挑選重點|製造)$/],
]

/** 拿掉小標題前後的裝飾：編號、emoji、括號、#、結尾冒號 */
function cleanHeading(line: string): { text: string; decorated: boolean } {
  let t = line.trim()
  const before = t
  t = t.replace(/^#{1,6}\s*/, '')
  t = t.replace(/^(?:\p{Extended_Pictographic}|[■□●○◆◇★☆▶►➤✅✔☑✓▪▫※])️?\s*/u, '')
  t = t.replace(/^(?:\d{1,2}\s*[.、．)）]|[（(]?[一二三四五六七八九十]+[）)、.．]|第[一二三四五六七八九十]+[部分章節]?)\s*/, '')
  const bracket = t.match(/^[【\[〔「『]\s*(.+?)\s*[】\]〕」』]$/)
  if (bracket) t = bracket[1]
  t = t.replace(/^\*\*(.+)\*\*$/, '$1').replace(/[：:]$/, '').trim()
  return { text: t, decorated: t !== before }
}

/** 一行是不是小標題；是的話回傳它屬於哪一種 */
export function detectSectionHeading(line: string): { kind: SectionKind; title: string } | null {
  const raw = line.trim()
  if (!raw || Array.from(raw).length > 20) return null
  const { text, decorated } = cleanHeading(raw)
  const n = Array.from(text).length
  if (n < 2 || n > 10) return null
  if (/[。！？!?，,；;、：:]/.test(text)) return null       // 「材質：艾絨」是規格行，不是標題
  if (/\d+\s*[｜|丨│]/.test(raw)) return null           // 「01｜標題」是特色卡，不是區塊標題
  const rule = KIND_RULES.find(([, re]) => re.test(text))
  if (rule) return { kind: rule[0], title: text }
  // 不認得的字，但明顯被包成標題（【】、## 、結尾冒號）→ 一般區塊
  if (decorated && (/^[【\[#〔]/.test(raw) || /[：:]$/.test(raw))) return { kind: 'other', title: text }
  return null
}

/** 依小標題切區塊。第一個小標題之前的內容是「開場」（intro）。 */
export function splitSections(text: string | null | undefined): Section[] {
  if (!text?.trim()) return []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: Section[] = []
  let cur: Section = { kind: 'intro', title: '', body: '' }
  const push = () => { cur.body = cur.body.replace(/^\n+|\n+$/g, ''); if (cur.body.trim() || cur.kind !== 'intro') out.push(cur) }
  for (const line of lines) {
    const h = detectSectionHeading(line)
    if (h) { push(); cur = { kind: h.kind, title: h.title, body: '' }; continue }
    cur.body += (cur.body ? '\n' : '') + line
  }
  push()
  return out.filter(s => s.body.trim() || s.kind !== 'intro')
}

/** 舊欄位（分開存的）組成一篇，前台與後台都當成「整篇」來處理 */
export interface LegacyFields {
  suitable_people?: string | null
  usage_method?: string | null
  pairing_tips?: string | null
  ingredients?: string | null
  precautions?: string | null
  storage_method?: string | null
  source_notes?: string | null
}

const LEGACY_ORDER: [keyof LegacyFields, string][] = [
  ['suitable_people', '適合誰'],
  ['usage_method', '使用方法'],
  ['pairing_tips', '搭配建議'],
  ['ingredients', '成分規格'],
  ['precautions', '注意事項'],
  ['storage_method', '保存方式'],
  ['source_notes', '來源與挑選'],
]

export function legacyToDescription(p: LegacyFields): string {
  const parts: string[] = []
  for (const [key, title] of LEGACY_ORDER) {
    const v = p[key]?.trim()
    if (!v) continue
    // 「適合誰」欄位以前常被拿來放整篇行銷文案（裡面自己有「產品特色」這類小標），
    // 開頭已經是小標的就不再多包一層「適合誰」
    const startsWithHeading = !!detectSectionHeading(v.split('\n')[0])
    parts.push(key === 'suitable_people' && startsWithHeading ? v : `${title}\n${v}`)
  }
  return parts.join('\n\n')
}

/**
 * 整篇 → 舊欄位。儲存時一起寫回去：文章推薦（看成分）、AI 文案、
 * 還沒執行 SQL 時的前台顯示，都還是讀這些欄位。
 * 重點、特色、開場、其他區塊沒有對應的舊欄位，連同小標一起放進「適合誰」欄位，內容不會丟。
 */
export function sectionsToLegacy(sections: Section[]): Required<LegacyFields> {
  const pick = (kind: SectionKind) => sections.filter(s => s.kind === kind).map(s => s.body.trim()).filter(Boolean).join('\n\n') || null
  const rest = sections
    .filter(s => ['intro', 'summary', 'features', 'who', 'other'].includes(s.kind))
    .map(s => (s.kind === 'intro' || !s.title ? s.body.trim() : `${s.title}\n${s.body.trim()}`))
    .filter(Boolean)
  // 只有「適合誰」一區的話不加小標（跟以前的資料長得一樣）
  const onlyWho = sections.filter(s => ['intro', 'summary', 'features', 'who', 'other'].includes(s.kind)).every(s => s.kind === 'who')
  return {
    suitable_people: onlyWho ? pick('who') : (rest.join('\n\n') || null),
    usage_method: pick('usage'),
    pairing_tips: pick('pairing'),
    ingredients: pick('spec'),
    precautions: pick('caution'),
    storage_method: pick('storage'),
    source_notes: pick('source'),
  }
}

/**
 * 規格區：「成分：NAC 500mg」這種一行一項的寫法 → 表格的列。
 * 寫在同一行、用句號隔開的也拆開（「成分：…。容量：…。」）。
 * 有一半以上不是「標籤：值」就不排表格，照一般段落顯示。
 */
export function specRows(body: string): { label: string; value: string }[] | null {
  const pieces = body.split('\n')
    .flatMap(line => line.split(/(?<=。)|；|;/))
    .map(s => s.replace(/^[\s•‧·・\-*◆●]+/, '').replace(/[。；;]$/, '').trim())
    .filter(Boolean)
  if (pieces.length < 2) return null
  const rows = pieces.map(s => s.match(/^([^：:]{1,10})[：:]\s*(.+)$/)).filter((m): m is RegExpMatchArray => !!m)
  if (rows.length < 2 || rows.length < pieces.length * 0.6 || rows.length !== pieces.length) return null
  return rows.map(m => ({ label: m[1].trim(), value: m[2].trim() }))
}

/** 特色區裡「01｜標題」的標題（給「先看重點」用） */
export function featureTitles(sections: Section[]): string[] {
  // 特色區寫成「標籤：說明」一行一項時，標籤就是特色的小標
  const labeled = sections.filter(s => s.kind === 'features').flatMap(s => labeledItems(s.body)?.map(x => x.label) || [])
  if (labeled.length) return labeled
  return sections
    .filter(s => s.kind === 'features' || s.kind === 'intro' || s.kind === 'other')
    .flatMap(s => s.body.split('\n'))
    .map(l => l.trim().match(/^\d{1,2}\s*[｜|丨│]\s*(.{2,24})$/))
    .filter((m): m is RegExpMatchArray => !!m && !/[。！？!?，,]/.test(m[1]))
    .map(m => m[1].trim())
}

/** 後台用：這篇認出了哪些區塊（顯示「已辨識：重點 ✓ 特色 ✓ …」） */
export const KIND_LABEL: Record<SectionKind, string> = {
  intro: '開場', summary: '重點', features: '特色', who: '適合誰', usage: '怎麼用',
  pairing: '怎麼搭', spec: '規格', caution: '注意事項', storage: '保存', source: '來源', other: '其他',
}

/**
 * 「標籤：說明」一行一項的寫法（客人截圖的紫蘇籽油「適合誰」就是這樣寫的）：
 *   不常吃魚、怕魚腥味的人：可從植物來源補充 Omega-3 ALA。
 *   素食／植物性飲食者：紫蘇籽油是很好的植物性 Omega-3 來源。
 * 每一行都是這種寫法、至少兩行才算；標籤 2～24 字。前面的條列符號、編號會先拿掉。
 * 前台把標籤加粗、說明換行淡一點，一眼就能掃過每一項。
 */
export function labeledItems(body: string): { label: string; desc: string }[] | null {
  const lines = body.split('\n')
    .map(l => l.trim().replace(/^(?:[•‧·・\-*◆●○■□★☆✅✔☑✓▪➤►▶]|\d{1,2}[.、．)）])\s*/, ''))
    .filter(Boolean)
  if (lines.length < 2) return null
  const items = lines.map(l => l.match(/^([^：:。！？]{2,24})[：:]\s*(.+)$/))
  if (items.some(m => !m)) return null
  return items.map(m => ({ label: m![1].trim(), desc: m![2].trim() }))
}

/** 每一行都是一句話（40 字內）的清單：「適合誰」這類區塊直接排成清單 */
export function lineItems(body: string, max = 40): string[] | null {
  const lines = body.split('\n')
    .map(l => l.trim().replace(/^(?:[•‧·・\-*◆●○■□★☆✅✔☑✓▪➤►▶]|\d{1,2}[.、．)）])\s*/, ''))
    .filter(Boolean)
  if (lines.length < 2) return null
  const items = lines.map(l => l.replace(/[。]$/, ''))
  return items.every(l => Array.from(l).length <= max && !/[。！？!?]/.test(l)) ? items : null
}
