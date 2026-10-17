/**
 * 把結構化資料放進 <script type="application/ld+json">。
 *
 * 直接用 JSON.stringify 的話，商品名稱或文章內容裡只要出現「</script>」，
 * 瀏覽器就會提早結束這段 script，後面的文字被當成網頁 HTML 執行。
 * 把 < > & 換成 \u 跳脫碼，JSON 意思不變，但不可能跳出 script。
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
