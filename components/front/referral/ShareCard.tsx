'use client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { withReferral } from '@/lib/referral'
import { SITE_URL } from '@/lib/siteUrl'
import { useMyReferral } from './useMyReferral'
import { copyText, lineShareUrl } from './referralClient'

const LINE_ICON = 'M19.365 9.863c.349 0 .63.285.631.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314'

export function LineIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={LINE_ICON} /></svg>
}

/**
 * 「傳給朋友」卡片：放在客人最想分享的時刻（下單後、寫完評價、團購頁、會員中心）。
 * 會員分享時自動附上自己的推薦碼；沒登入的照樣能分享，並引導註冊拿專屬連結。
 */
export default function ShareCard({ icon = '💚', title, subtitle, path = '/', message, medium = 'share', tone = 'green', className = '' }: {
  icon?: string
  title: string
  subtitle?: string
  /** 要分享的站內頁面 */
  path?: string
  /** 分享文字（連結會自動接在後面） */
  message: string
  medium?: string
  tone?: 'green' | 'sky' | 'amber'
  className?: string
}) {
  const { user, referral } = useMyReferral()
  const url = withReferral(`${SITE_URL}${path}`, referral?.code, medium)
  const text = `${message}\n${url}`
  const toneCls = { green: 'border-green-200 bg-green-50', sky: 'border-sky-200 bg-sky-50', amber: 'border-amber-200 bg-amber-50' }[tone]

  const copy = async () => {
    if (await copyText(text)) toast.success('已複製，貼到 LINE 或簡訊就能傳')
    else toast.error('複製失敗，請長按連結手動複製')
  }

  return (
    <section className={`rounded-3xl border-2 p-5 ${toneCls} ${className}`}>
      <p className="flex items-center gap-2 text-lg font-bold text-gray-900"><span aria-hidden>{icon}</span>{title}</p>
      {subtitle && <p className="mt-1 text-[15px] leading-relaxed text-gray-700">{subtitle}</p>}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto]">
        <a href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#06C755] text-[17px] font-bold text-white shadow-sm active:opacity-90">
          <LineIcon /> 傳給 LINE 好友
        </a>
        <button type="button" onClick={copy}
          className="flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-gray-200 bg-white px-5 text-[15px] font-bold text-gray-700 active:bg-gray-50">
          複製連結
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
        {user
          ? referral?.code
            ? <>已附上您的專屬推薦碼 <b className="font-mono tracking-wider text-gray-800">{referral.code}</b>，可以在 <Link href="/account/invite" className="font-bold text-green-700 underline">會員中心・邀請親友</Link> 看到有幾位朋友因您而來 🙏</>
            : null
          : <>💡 <Link href={`/signup?next=${encodeURIComponent('/account/invite')}`} className="font-bold text-green-700 underline">免費註冊會員</Link>後分享，就能看到有幾位親友因您而來</>}
      </p>
    </section>
  )
}
