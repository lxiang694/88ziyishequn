/**
 * 手機號碼輸入框的整理與顯示（純函式，可測試）。
 *
 * 客人可能貼上「0912-345-678」「0912 345 678」「+886 912 345 678」，
 * 也可能用全形數字。一律整理成 10 碼數字；顯示時分成 4-3-3，比較好核對。
 */
export function normalizePhoneInput(raw: string): string {
  let d = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\D/g, '')
  if (d.startsWith('886')) d = '0' + d.slice(3).replace(/^0/, '')   // +886 912… / 886 0912…
  return d.slice(0, 10)
}

/** 0912345678 → 0912 345 678（打到一半也照樣分組） */
export function formatPhoneDisplay(digits: string): string {
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ')
}

/** 輸入中的提示：還差幾碼、開頭不對、或已經正確 */
export function phoneHint(digits: string): { tone: 'idle' | 'typing' | 'error' | 'ok'; text: string } {
  if (!digits) return { tone: 'idle', text: '請輸入 09 開頭的 10 碼手機號碼' }
  if (!digits.startsWith('0') || (digits.length >= 2 && !digits.startsWith('09'))) return { tone: 'error', text: '手機號碼要以 09 開頭' }
  if (digits.length < 10) return { tone: 'typing', text: `還差 ${10 - digits.length} 碼` }
  return { tone: 'ok', text: '號碼格式正確' }
}
