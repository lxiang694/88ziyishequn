'use client'
import { useEffect, useState } from 'react'
import { useUserAuth } from '@/components/front/UserAuthContext'

export interface MyReferral {
  ready: boolean
  code?: string
  link?: string
  stats?: { visits: number; signups: number; orders: number; friends: number; new_customers: number }
}

// 同一頁面多個分享按鈕共用一次查詢
let cache: { userId: string; data: Promise<MyReferral> } | null = null

/** 會員自己的推薦碼與成效；沒登入回 null */
export function useMyReferral() {
  const { user, authedFetch } = useUserAuth()
  const [data, setData] = useState<MyReferral | null>(null)
  useEffect(() => {
    if (!user) { setData(null); return }
    if (!cache || cache.userId !== user.id) {
      cache = {
        userId: user.id,
        data: authedFetch('/api/account/referral').then(r => r.json()).then(d => (d.success ? d : { ready: false })).catch(() => ({ ready: false })),
      }
    }
    let alive = true
    cache.data.then(d => { if (alive) setData(d) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  return { user, referral: data }
}
