export function normalizeProductHeading(line: string): string {
  return line.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '').replace(/[\u00a0\u3000]/g, ' ').trim()
}

/** 商品特色標題的共同規則。僅整理格式字元，不改正文與標點。 */
export function parseFeatureHeading(line: string): { num: string; title: string } | null {
  const text = normalizeProductHeading(line)
    .replace(/^#{1,6}\s*/, '').replace(/^\*\*(.+)\*\*$/, '$1').trim()
  const match = text.match(/^([0-9０-９]{1,2})\s*[｜|丨│]\s*(.+)$/u)
  if (!match) return null
  const title = match[2].trim()
  if (Array.from(title).length < 2 || Array.from(title).length > 60) return null
  const num = match[1].replace(/[０-９]/g, c => String(c.charCodeAt(0) - 65296)).padStart(2, '0')
  return { num, title }
}

/** 使用者明確指定格式時，只調整游標所在的一行。 */
export function formatProductLine(value: string, start: number, end: number, feature: boolean):
  { error: string } | { value: string; start: number; end: number } {
  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak < 0 ? value.length : nextBreak
  const original = value.slice(lineStart, lineEnd)
  if (original.includes('\n') || !original.trim()) return { error: '請一次選取一行文字' } as const
  let text = original.trim().replace(/^#{1,6}\s*/, '').replace(/^\*\*(.+)\*\*$/, '$1')
  if (text.startsWith('\\')) text = text.slice(1)
  if (feature) {
    const heading = parseFeatureHeading(text)
    if (heading) text = `### ${heading.num}｜${heading.title}`
    else {
      if (Array.from(text).length < 2 || Array.from(text).length > 60) return { error: '特色標題請填寫 2～60 個字' } as const
      const used = value.split('\n').map(parseFeatureHeading).filter(h => h !== null).map(h => Number(h.num))
      const number = Math.max(0, ...used) + 1
      if (number > 99) return { error: '特色標題編號已超過 99，請先整理編號' } as const
      text = `### ${String(number).padStart(2, '0')}｜${text}`
    }
  } else text = '\\' + text.replace(/^[0-9０-９]{1,2}\s*[｜|丨│]\s*/, '')
  return { value: value.slice(0, lineStart) + text + value.slice(lineEnd), start: lineStart, end: lineStart + text.length } as const
}
