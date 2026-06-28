// 邀請裂變共用工具

// 網站網址（用於組邀請連結）。可用環境變數覆寫，預設為正式網域。
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://healthec.vercel.app'

// 邀請成功發給邀請人的積分數
export const REFERRAL_POINTS = Number(process.env.REFERRAL_POINTS || 10)

// 邀請碼字元集（去掉容易混淆的 0/O/1/I）
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 產生一組隨機邀請碼（預設 6 碼） */
export function genReferralCode(len = 6): string {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

/** 由邀請碼組成完整邀請連結 */
export function inviteLink(code: string): string {
  return `${SITE_URL}/invite/${code}`
}

/**
 * 從一段文字中嘗試取出邀請碼。
 * 先找「邀請碼 XXXX」這種明確格式，找不到再找獨立的 4~12 碼英數字串。
 * 回傳大寫邀請碼或 null。
 */
export function extractCode(text: string): string | null {
  if (!text) return null
  const upper = text.toUpperCase()
  const labelled = upper.match(/邀請碼[\s:：]*([A-Z2-9]{4,12})/)
  if (labelled) return labelled[1]
  const bare = upper.match(/\b([A-Z2-9]{6})\b/)
  if (bare) return bare[1]
  return null
}
