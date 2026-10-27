/**
 * 7-11 取件人姓名規則（前台結帳、團購、後台修改、賣貨便轉單共用）。
 *
 * 跟賣貨便 1.5 版匯入範本一致：
 *   • 只能有中文或英文字母（可以有空格），不能有數字、標點、符號
 *   • 最少 2 個字
 *   • 最多 5 個中文字或 10 個半形字元（中文算 2）
 * 下單時就擋下來、提示客人改，不要等到轉賣貨便才發現。
 */
const nameLength = (s: string) => Array.from(s).reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0)

export function recipientNameError(raw: string | null | undefined): string | null {
  const name = (raw || '').trim()
  if (!name) return '請填寫取件人姓名'
  if (!/^[\p{L}\p{M} ]+$/u.test(name)) return '姓名只能是中文或英文字母，不能有數字、標點或符號'
  if (Array.from(name.replace(/\s/g, '')).length < 2) return '姓名至少要 2 個字'
  if (nameLength(name) > 10) return '姓名最多 5 個中文字或 10 個英文字母'
  return null
}

/**
 * 猜一個修正後的姓名給客人一鍵套用：去掉數字、標點、符號與多餘空白。
 * 「鄭景耀,」→「鄭景耀」。修正後仍不合規則（或跟原本一樣）就回 null。
 */
export function suggestRecipientName(raw: string | null | undefined): string | null {
  const name = (raw || '').trim()
  const cleaned = name.replace(/[^\p{L}\p{M} ]/gu, '').replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned === name || recipientNameError(cleaned)) return null
  return cleaned
}
