/**
 * 團購說明、商品介紹的前處理（純函式，可測試）。
 * 品牌方文案常用 ◆ ✱ 當條列、《 》【 】當小標，轉成文章解析器認得的寫法。
 */

export function normalizeGroupBuyText(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const t = line.trim()
    // 《 商品規格說明 》、【保存方式】單獨一行 → 小標
    const title = t.match(/^(?:《\s*(.+?)\s*》|【\s*(.+?)\s*】)$/)
    if (title) return `### ${title[1] ?? title[2]}`
    // ◆ ✱ ★ ● ■ ✔ 開頭 → 條列
    return t.replace(/^[◆◇✱✳★☆●○■□✔✅✓❖➤►▶]\s*/, '- ')
  }).join('\n')
}

