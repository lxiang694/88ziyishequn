'use client'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

/**
 * Vercel Web Analytics（流量來源：Google、Facebook、LINE…）。
 * 只放在前台；網址上的查詢參數只留 utm_*，其他（訂單編號、搜尋字等）不送出。
 */
function keepUtmOnly(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url)
  for (const key of [...url.searchParams.keys()]) {
    if (!key.startsWith('utm_')) url.searchParams.delete(key)
  }
  return { ...event, url: url.toString() }
}

export default function VercelAnalytics() {
  return <Analytics beforeSend={keepUtmOnly} />
}
