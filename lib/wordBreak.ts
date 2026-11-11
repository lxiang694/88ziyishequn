/**
 * 把品名切成「詞」，讓換行只發生在詞與詞之間。
 *
 * 首頁商品卡很窄，瀏覽器預設在任何中文字之間都可以換行，常常斷成
 * 「6合一綜合維生／素」。這裡用 Intl.Segmenter 斷詞，畫面上在詞與詞之間
 * 放 <wbr>，再配合 word-break: keep-all，就只會斷成「6合一綜合／維生素」。
 *
 * Segmenter 對品名切得太碎（益生|菌、足|浴|包），所以單一個字一律
 * 併到前一個詞：益生菌、晚安|足浴包。
 *
 * 在伺服器算好再傳給畫面 —— 瀏覽器與伺服器的斷詞字典可能不同，
 * 兩邊各算一次會對不上（React hydration 警告）。
 */
export function nameSegments(name: string): string[] {
  const Seg = (Intl as any).Segmenter
  if (!name || typeof Seg !== 'function') return [name]
  const out: string[] = []
  for (const { segment } of new Seg('zh-Hant', { granularity: 'word' }).segment(name)) {
    const single = Array.from(segment).length === 1
    if (out.length && (single || /^\s/.test(segment))) out[out.length - 1] += segment
    else out.push(segment)
  }
  // 開頭單獨一個字（例如「6合一」的 6）併到後一個詞
  if (out.length > 1 && Array.from(out[0]).length === 1) out.splice(0, 2, out[0] + out[1])
  return out
}
