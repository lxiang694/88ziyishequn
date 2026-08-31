export function generateOrderNo(): string {
  const now = new Date()
  const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const date = twNow.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 900000) + 100000
  return `TW${date}${rand}`
}

export function validateTWPhone(phone: string): boolean {
  return /^09\d{8}$/.test(phone.trim())
}

export function formatPrice(price: number): string {
  return `NT$${Number(price).toLocaleString('zh-TW')}`
}

export function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
  } catch { return dateStr }
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    '待確認': 'bg-yellow-100 text-yellow-800',
    '已確認': 'bg-blue-100 text-blue-800',
    '備貨中': 'bg-purple-100 text-purple-800',
    '已出貨': 'bg-indigo-100 text-indigo-800',
    '已到店': 'bg-green-100 text-green-800',
    '已取消': 'bg-red-100 text-red-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

export function generateSlug(name: string): string {
  return `${name.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').slice(0, 50)}-${Date.now()}`
}

/**
 * \u6574\u7406\u4f7f\u7528\u8005\u81ea\u8a02\u7684\u7db2\u5740\u8b58\u5225\u78bc\u3002
 *
 * \u53ea\u7559\u5c0f\u5beb\u82f1\u6578\u8207\u9023\u5b57\u865f \u2014\u2014 \u4e2d\u6587\u53ef\u4ee5\u653e\u5728\u7db2\u5740\u88e1\uff0c\u4f46\u6703\u88ab\u700f\u89bd\u5668\u7de8\u78bc\u6210
 * \u4e00\u9577\u4e32 %E9%87%8E...\uff0c\u5206\u4eab\u51fa\u53bb\u5f88\u96e3\u770b\uff0c\u4e5f\u4e0d\u5229\u641c\u5c0b\u3002
 * \u56de\u50b3\u7a7a\u5b57\u4e32\u4ee3\u8868\u300c\u6c92\u6709\u6709\u6548\u5167\u5bb9\u300d\uff0c\u547c\u53eb\u7aef\u5c31\u9000\u56de\u81ea\u52d5\u7522\u751f\u3002
 */
export function normalizeSlug(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const ORDER_STATUSES = ['待確認', '已確認', '備貨中', '已出貨', '已到店', '已取消']

// 活動報名於「開始時間前 2 小時」自動關閉；未設定開始時間則不自動關閉
export const EVENT_CLOSE_BEFORE_MS = 2 * 60 * 60 * 1000
export function isEventRegistrationClosed(startsAt: string | null | undefined): boolean {
  if (!startsAt) return false
  return Date.now() >= new Date(startsAt).getTime() - EVENT_CLOSE_BEFORE_MS
}
