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

const HONORIFIC = /(先生|小姐|太太|女士|媽媽|阿姨|阿伯|伯伯|老師|哥|姐|姊)$/

/**
 * 姓名看起來是稱呼（「邱先生」「王小姐」「陳媽媽」）時給一個提醒。
 * 這種寫法賣貨便收得下，但 7-11 櫃台對不到人，取貨時容易卡住，所以下單時先提醒。
 * 只提醒、不擋單：去掉稱呼後還有 2 個字以上（「邱志明先生」）就建議改成那個名字。
 */
export function honorificHint(raw: string | null | undefined): { message: string; suggestion: string | null } | null {
  const name = (raw || '').trim()
  if (recipientNameError(name)) return null
  const m = name.match(HONORIFIC)
  if (!m) return null
  const rest = name.slice(0, -m[1].length).trim()
  if (Array.from(rest).length >= 2) return { message: `姓名後面不用加「${m[1]}」`, suggestion: rest }
  return { message: `「${name}」看起來是稱呼，請填完整姓名（例如：${rest || '王'}小明），取貨時比較好核對`, suggestion: null }
}
