'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useUserAuth, useRequireUser } from '@/components/front/UserAuthContext'
import { formatDateTime } from '@/lib/utils'

interface ReferralData {
  code: string | null
  link: string | null
  points: number
  rewardPerInvite: number
  invitedCount: number
  referrals: { id: number; code: string; status: string; points_awarded: number; created_at: string }[]
}

export default function ReferralPage() {
  const { user, loading } = useRequireUser()
  const { authedFetch } = useUserAuth()
  const [data, setData] = useState<ReferralData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    authedFetch('/api/account/referral')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data) })
      .finally(() => setLoadingData(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const copyLink = async () => {
    if (!data?.link) return
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
      toast.success('邀請連結已複製')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('複製失敗，請手動複製')
    }
  }

  if (loading || loadingData) {
    return <div className="py-20 text-center text-gray-400">載入中...</div>
  }
  if (!user || !data) return null

  const shareText = '我在「健康優選」發現不少好物，邀請你一起加入 LINE 看保健新知 👇'
  const lineShareUrl = data.link
    ? `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${data.link}`)}`
    : '#'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center gap-2 mb-5">
          <Link href="/account" className="text-gray-400 hover:text-gray-600 text-sm">← 會員中心</Link>
        </div>

        {/* Points banner */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-6 text-white shadow-lg shadow-green-100 mb-5">
          <p className="text-green-100 text-sm mb-1">我的積分</p>
          <p className="text-4xl font-bold mb-4">{data.points} <span className="text-lg font-normal">分</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{data.invitedCount}</p>
              <p className="text-xs text-green-100 mt-0.5">成功邀請人數</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{data.rewardPerInvite}</p>
              <p className="text-xs text-green-100 mt-0.5">每邀請一人積分</p>
            </div>
          </div>
        </div>

        {/* Invite link */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="font-bold text-gray-800 mb-1">我的專屬邀請連結</h2>
          <p className="text-xs text-gray-400 mb-3">
            朋友透過此連結加入官方帳號並送出邀請碼後，你就能獲得 {data.rewardPerInvite} 積分
          </p>

          {data.link ? (
            <>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 mb-3">
                <span className="flex-1 text-sm text-gray-600 truncate font-mono">{data.link}</span>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  {copied ? '已複製' : '複製'}
                </button>
              </div>

              <a
                href={lineShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 rounded-xl transition-colors text-base"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.631.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                分享到 LINE
              </a>

              <p className="text-center text-xs text-gray-400 mt-3">
                你的邀請碼：<span className="font-mono font-bold text-gray-600">{data.code}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">邀請碼產生中，請稍後重新整理。</p>
          )}
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 mb-4">邀請紀錄</h2>
          {data.referrals.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl mb-2">🤝</div>
              <p className="text-gray-400 text-sm">還沒有人透過你的連結加入，快分享給朋友吧！</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referrals.map(r => (
                <div key={r.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">新朋友加入 🎉</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(r.created_at)}</p>
                  </div>
                  <span className="text-green-700 font-bold text-sm">+{r.points_awarded} 分</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
