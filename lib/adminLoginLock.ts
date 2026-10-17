/**
 * 後台登入鎖定（純函式，可測試）。規則：同一個帳號連續輸錯 3 次，鎖定 15 分鐘。
 * 計數與鎖定時間存在資料庫 admin_users（migrations/admin_login_lockout.sql）。
 */
export const MAX_FAILED_LOGINS = 3
export const LOCK_MINUTES = 15

/** 鎖定中嗎？資料庫還沒加欄位時 lockedUntil 是 undefined，視為沒鎖 */
export function isLocked(lockedUntil: string | null | undefined, now = new Date()): boolean {
  if (!lockedUntil) return false
  const t = new Date(lockedUntil).getTime()
  return Number.isFinite(t) && t > now.getTime()
}

/** 「請於 17:47 後再試（約 15 分鐘）」：台灣時間 24 小時制 */
export function lockedMessage(lockedUntil: string, now = new Date()): string {
  const until = new Date(lockedUntil)
  const hm = new Date(until.getTime() + 8 * 3600_000).toISOString().slice(11, 16)
  const mins = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000))
  return `密碼連續輸錯 ${MAX_FAILED_LOGINS} 次，帳號已暫時鎖定。請於 ${hm} 後再試（約 ${mins} 分鐘）。`
}

/**
 * 輸錯時的提示。不顯示「還剩幾次」：帳號不存在時無從計算，若只有存在的帳號
 * 才顯示次數，就等於告訴別人哪些帳號是真的。
 */
export const WRONG_PASSWORD_MESSAGE = `帳號或密碼錯誤。連續輸錯 ${MAX_FAILED_LOGINS} 次會鎖定 ${LOCK_MINUTES} 分鐘。`
