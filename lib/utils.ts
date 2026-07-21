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

export const ORDER_STATUSES = ['待確認', '已確認', '備貨中', '已出貨', '已到店', '已取消']

// 活動報名於「開始時間前 2 小時」自動關閉；未設定開始時間則不自動關閉
export const EVENT_CLOSE_BEFORE_MS = 2 * 60 * 60 * 1000
export function isEventRegistrationClosed(startsAt: string | null | undefined): boolean {
  if (!startsAt) return false
  return Date.now() >= new Date(startsAt).getTime() - EVENT_CLOSE_BEFORE_MS
}
