/**
 * 面單處理：解析貼上的訂單號清單 —— 純函式。
 *
 * 出貨流程是「在 3 個賣場各自挑幾筆訂單」，賣貨便的批次列印又是按
 * 賣場分開的，所以一次出貨可能產生好幾份 PDF、涵蓋的訂單也未必等於
 * 系統裡的待出貨清單。
 *
 * 因此以**使用者貼上的清單**為準，不是以 myship_transfers 為準 ——
 * 那份清單才是「這一批到底要出哪幾筆」的唯一真相。
 *
 * 貼上的來源可能是賣貨便的畫面、Excel、Line 訊息，格式不會統一，
 * 所以這裡吃得越寬鬆越好：換行、逗號、頓號、空白、Tab 都可以當分隔，
 * 中間夾雜其他文字也沒關係。
 */

/**
 * 賣貨便訂單編號：CM + 13 位數字。
 * 與 app/api/admin/myship/confirm 的驗證一致。
 */
export const ORDER_NO_PATTERN = /CM\d{13}(?!\d)/g

/**
 * 面單 PDF 上的「寄貨訂單編號」會多一個 -0 之類的子單號後綴。
 *
 * 結尾的 (?!\d) 很重要：沒有它的話，打錯多一位的 CM26092147194321
 * 會被默默截成 CM2609214719432 —— 那是一個合法、但可能對應到
 * 另一筆真實訂單的號碼。寧可整串不認，也不要截出一個像真的號碼。
 */
export const ORDER_NO_WITH_SUFFIX = /(CM\d{13})(?!\d)(?:-\d+)?/g

export const MAX_ORDERS = 500

export interface ParsedOrderList {
  /** 去重後的訂單號，保留第一次出現的順序 */
  orderNos: string[]
  /** 重複貼到的（只是提醒，已自動去重） */
  duplicates: string[]
  /** 給人看的提醒 */
  warnings: string[]
}

/** 全形英數轉半形，否則貼上「ＣＭ２６０９…」會抓不到 */
function toHalfWidth(input: string): string {
  return input
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/ /g, ' ')
}

/**
 * 從一段文字裡抓出所有訂單號。
 *
 * 刻意不做「整行必須只有訂單號」這種要求 —— 使用者常常整塊複製，
 * 裡面會夾著日期、金額、賣場名稱。與其要求他先整理，不如直接挑出來。
 */
export function parseOrderList(input: string | null | undefined): ParsedOrderList {
  const warnings: string[] = []
  const text = toHalfWidth(input || '')

  if (!text.trim()) {
    return { orderNos: [], duplicates: [], warnings: ['請貼上要出貨的訂單號'] }
  }

  const seen = new Set<string>()
  const duplicateSet = new Set<string>()
  const orderNos: string[] = []

  for (const m of text.matchAll(ORDER_NO_WITH_SUFFIX)) {
    const no = m[1]
    if (seen.has(no)) { duplicateSet.add(no); continue }
    seen.add(no)
    orderNos.push(no)
  }

  if (orderNos.length === 0) {
    return {
      orderNos: [], duplicates: [],
      warnings: ['找不到訂單號。格式應該像 CM2609214719479（CM 開頭加 13 位數字）'],
    }
  }

  if (duplicateSet.size > 0) {
    warnings.push(`有 ${duplicateSet.size} 筆訂單號重複貼到，已自動去重`)
  }

  if (orderNos.length > MAX_ORDERS) {
    warnings.push(`一次最多處理 ${MAX_ORDERS} 筆，其餘已忽略`)
    return { orderNos: orderNos.slice(0, MAX_ORDERS), duplicates: [...duplicateSet], warnings }
  }

  return { orderNos, duplicates: [...duplicateSet], warnings }
}

// ── 對帳 ────────────────────────────────────────────────

export interface Reconciliation {
  /** 清單上有、PDF 裡也找到 —— 會放進 ZIP */
  matched: string[]
  /** 清單上有、但這批 PDF 裡沒有 → 漏印 */
  missing: string[]
  /** PDF 裡有、但不在清單上 → 多印，不會放進 ZIP */
  extra: string[]
}

/**
 * 比對「要出貨的清單」與「PDF 裡實際有的面單」。
 *
 * 這是整個工具最重要的部分。3 個賣場、每個賣場十幾筆訂單裡只挑幾筆，
 * 漏勾一筆或多勾一筆現在沒有任何東西會抓到 —— 要等新比銳那邊數量
 * 對不上，或是客人來問貨在哪。
 *
 * 多印的面單刻意**不放進 ZIP**：那些訂單的貨沒有要出，面單傳上去
 * 會讓倉庫等一個不會到的包裹。
 */
export function reconcile(
  requested: readonly string[],
  foundInPdf: readonly string[],
): Reconciliation {
  const found = new Set(foundInPdf)
  const want = new Set(requested)

  return {
    matched: requested.filter(no => found.has(no)),
    missing: requested.filter(no => !found.has(no)),
    // 去重後保留 PDF 裡出現的順序
    extra: [...new Set(foundInPdf)].filter(no => !want.has(no)),
  }
}
