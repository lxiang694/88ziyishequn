/**
 * 一句話簡介 → 「主句」＋「補充」。
 *
 * 管理員寫的簡介常常是兩三句話擠成一段（「有機紫蘇籽油是……植物油，主打天然、清爽。
 * 紫蘇籽本身含有……適合作為日常飲食中的好油補充。」），整段同樣大小、同樣顏色，
 * 讀起來像一堆字。拆成第一句（粗體、大一點，一眼看懂是什麼）＋後面的補充（淡一點、小一點）。
 *
 * 第一句太長（超過 60 字）或整段只有一句時不拆，整段當主句。
 */
export function splitIntroLead(text: string | null | undefined): { lead: string; rest: string } {
  const t = (text || '').trim().replace(/\s*\n+\s*/g, ' ')
  const m = t.match(/^(.+?[。！？!?])\s*(.+)$/)
  if (!m || Array.from(m[1]).length > 60) return { lead: t, rest: '' }
  return { lead: m[1].trim(), rest: m[2].trim() }
}

/**
 * 「Omega-3」「α-亞麻酸」這種有連字號的詞，瀏覽器會在「-」後面換行（Omega- ／3），
 * 很難讀。切出來讓畫面用不換行的 span 包住。回傳 [文字, 是否不換行][]。
 */
export function hyphenTokens(text: string): [string, boolean][] {
  return text.split(/([A-Za-z0-9Ͱ-Ͽ]+(?:-[A-Za-z0-9Ͱ-Ͽ一-鿿]+)+)/u)
    .filter(Boolean)
    .map(s => [s, /-/.test(s) && /^[A-Za-z0-9Ͱ-Ͽ]/u.test(s)] as [string, boolean])
}
