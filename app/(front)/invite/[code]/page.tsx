import { supabaseAdmin } from '@/lib/supabase'
import InviteActions from '@/components/front/InviteActions'
import { REFERRAL_POINTS } from '@/lib/referral'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '好友邀請 | 88自醫社群團購賣場',
  description: '朋友邀請你加入健康優選 LINE，一起關注保健新知。',
}

async function getReferrerName(code: string): Promise<string | null> {
  const upper = code.toUpperCase()
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('name')
    .eq('referral_code', upper)
    .maybeSingle()
  // 找不到代表邀請碼無效
  if (data === null) return null
  return data?.name || '你的朋友'
}

export default async function InvitePage({ params }: { params: { code: string } }) {
  const code = (params.code || '').toUpperCase()
  const referrerName = await getReferrerName(code)
  const oaBasicId = process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID || ''

  // 邀請碼無效
  if (!referrerName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">邀請連結無效</h1>
          <p className="text-gray-500 text-sm mb-6">
            這組邀請碼不存在或已失效，請向邀請你的朋友確認連結是否正確。
          </p>
          <a href="/" className="btn-primary inline-flex">前往首頁逛逛</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-6 text-white shadow-lg shadow-green-100 mb-5 text-center">
          <div className="text-5xl mb-3">🎁</div>
          <p className="text-green-100 text-sm mb-1">{referrerName} 邀請你加入</p>
          <h1 className="text-2xl font-bold mb-3">健康優選 LINE 社群</h1>
          <p className="text-green-50 text-sm leading-relaxed">
            加入官方帳號並送出邀請碼，{referrerName}就能獲得 {REFERRAL_POINTS} 積分回饋，
            你也能收到我們嚴選的保健新知與團購優惠。
          </p>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <p className="font-bold text-gray-700 mb-3 text-sm">怎麼領好友禮？</p>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">1</span>
              <span>點下方綠色按鈕，自動開啟 LINE 並帶入邀請碼</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">2</span>
              <span>在 LINE 裡點「加入」官方帳號，並把帶入的訊息送出</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">3</span>
              <span>完成！系統會自動發 {REFERRAL_POINTS} 積分給邀請你的朋友 🎉</span>
            </li>
          </ol>
        </div>

        {/* Actions */}
        <InviteActions code={code} oaBasicId={oaBasicId} />

        <p className="text-center text-xs text-gray-400 mt-6">
          每位新朋友限領一次好友禮
        </p>
      </div>
    </div>
  )
}
