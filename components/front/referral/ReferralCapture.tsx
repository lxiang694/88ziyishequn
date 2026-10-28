'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUserAuth } from '@/components/front/UserAuthContext'
import { captureRefFromUrl, getStoredRef } from './referralClient'

/**
 * 好友推薦：
 *   1. 網址帶 ?ref=推薦碼 → 記在瀏覽器 30 天，並記一次點擊
 *   2. 之後在這台裝置註冊或登入 → 記成「這位會員是誰推薦的」（只記第一次）
 * 不渲染任何東西，失敗也不影響頁面。
 */
export default function ReferralCapture() {
  const pathname = usePathname()
  const { user, authedFetch } = useUserAuth()

  useEffect(() => {
    const code = captureRefFromUrl()
    if (!code) return
    const key = `ref_visit_${code}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch {}
    fetch('/api/referral/visit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, landing: pathname }), keepalive: true,
    }).catch(() => {})
  }, [pathname])

  useEffect(() => {
    if (!user) return
    const code = getStoredRef()
    if (!code) return
    const key = `ref_claim_${user.id}`
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, code) } catch {}
    authedFetch('/api/referral/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return null
}
