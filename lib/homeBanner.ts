/**
 * 首頁橫幅（取代原本的「四步驟完成購物」區塊）。
 *
 * 原本那塊是寫死的四個步驟圖示，要換內容得改程式重新部署。改成後台
 * 上傳一張 16:9 的圖片。
 *
 * 沒有上傳、或圖片被關掉時，首頁會自動用回原本的四步驟區塊 ——
 * 首頁不應該因為一個還沒設定的欄位就開一個天窗。
 */

export interface HomeBanner {
  image_url: string | null
  /** 圖片的文字說明，圖片在用的時候是必填，見 canDisplay */
  alt_text: string
  /** 點擊後前往的站內路徑；留空代表圖片不可點 */
  link_path: string | null
  is_active: boolean
}

/** 首頁橫幅的顯示比例。後台預覽與前台渲染都用這個值。 */
export const BANNER_ASPECT = 16 / 9

/** 建議的圖片尺寸。比這個小會在大螢幕上糊掉。 */
export const RECOMMENDED_WIDTH = 1600
export const RECOMMENDED_HEIGHT = 900

/**
 * 連結必須是站內路徑，而且不可帶參數。
 *
 * 與站上彈窗（site_popups）同一套規則：query string 會進到伺服器 log
 * 與分析工具，而深層頁面本來就會自己再做一次授權檢查，連結不需要
 * 也不該夾帶任何東西。
 */
export function isSafeLinkPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const path = value.trim()
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false          // 協定相對網址會跳到外站
  if (path.includes('?') || path.includes('#')) return false
  if (path.includes('\\')) return false
  return path.length <= 200
}

/**
 * 這個橫幅現在能不能顯示。
 *
 * alt_text 是必要條件而不是選填：這塊區域原本放的是「怎麼完成下單」
 * 這種實際資訊，換成圖片之後，沒有文字說明的話，用讀屏軟體的人與
 * 搜尋引擎就什麼都拿不到了。
 */
export function canDisplay(banner: HomeBanner | null | undefined): banner is HomeBanner {
  if (!banner) return false
  if (!banner.is_active) return false
  if (!banner.image_url || !banner.image_url.trim()) return false
  if (!banner.alt_text || !banner.alt_text.trim()) return false
  return true
}

/** 有連結而且連結安全時，回傳它；否則回 null（圖片就只是圖片） */
export function bannerLink(banner: HomeBanner): string | null {
  return isSafeLinkPath(banner.link_path) ? banner.link_path.trim() : null
}

export interface AspectCheck {
  ok: boolean
  /** 給後台顯示的提醒；ok 為 true 時是空字串 */
  message: string
}

/**
 * 檢查上傳的圖片比例離 16:9 有多遠。
 *
 * 不擋下不合比例的圖 —— 前台是用 object-cover 填滿，比例不對只是會被
 * 裁掉邊，不會破版。但要讓使用者知道會被裁，不然他會以為圖片上傳壞了。
 */
export function checkAspect(width: number, height: number): AspectCheck {
  if (!(width > 0) || !(height > 0)) {
    return { ok: false, message: '讀不到圖片尺寸，請換一張試試' }
  }
  const ratio = width / height
  const drift = Math.abs(ratio - BANNER_ASPECT) / BANNER_ASPECT

  if (drift <= 0.05) return { ok: true, message: '' }

  const side = ratio > BANNER_ASPECT ? '左右兩側' : '上下'
  return {
    ok: false,
    message: `這張圖是 ${width}×${height}（約 ${ratio.toFixed(2)}:1），不是 16:9。`
      + `顯示時會裁掉${side}，重要的字或人臉請放在中間。`
      + `建議用 ${RECOMMENDED_WIDTH}×${RECOMMENDED_HEIGHT}。`,
  }
}

/** 圖片太小在大螢幕上會糊。回空字串代表沒問題。 */
export function checkResolution(width: number): string {
  if (width >= RECOMMENDED_WIDTH) return ''
  if (width >= 1000) return `寬度只有 ${width}px，在桌機大螢幕上會有點糊，建議 ${RECOMMENDED_WIDTH}px 以上。`
  return `寬度只有 ${width}px，會明顯糊掉。建議重新輸出成 ${RECOMMENDED_WIDTH}×${RECOMMENDED_HEIGHT}。`
}
