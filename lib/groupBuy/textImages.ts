/**
 * 團購說明、商品介紹裡的圖片（純函式，可測試）。
 *
 * 圖片用文章同一套寫法存在文字裡：單獨一行 ![說明](網址)。
 * 後台按「插入圖片」上傳後自動插在游標的位置，不用自己打網址；
 * 前台由 GroupBuyText 顯示成整張圖。
 */
const IMAGE_LINE = /^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/

export const imageLine = (url: string) => `![](${url})`

/** 在 pos 的位置插入一張圖（自成一行，前後的文字不會黏在一起）；回傳新文字與插入後游標位置 */
export function insertImage(text: string, pos: number, url: string): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(pos, text.length))
  const before = text.slice(0, at), after = text.slice(at)
  const lead = before === '' || before.endsWith('\n') ? '' : '\n'
  const trail = after.startsWith('\n') ? '' : '\n'
  const insert = `${lead}${imageLine(url)}${trail}`
  return { text: before + insert + after, cursor: before.length + insert.length }
}

/** 文字裡有哪些圖（依出現順序），line 是第幾行，給「移除」用 */
export function listImages(text: string): { line: number; url: string }[] {
  return text.split('\n').flatMap((l, line) => {
    const m = l.trim().match(IMAGE_LINE)
    return m ? [{ line, url: m[2] }] : []
  })
}

/** 移除第 line 行的圖片 */
export function removeImageLine(text: string, line: number): string {
  const lines = text.split('\n')
  if (!IMAGE_LINE.test((lines[line] || '').trim())) return text
  lines.splice(line, 1)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** 只顯示 http(s) 的圖片網址，其他（javascript: 之類）一律不顯示 */
export const isSafeImageUrl = (src: string) => /^https?:\/\/[^\s"'<>]+$/.test(src)
