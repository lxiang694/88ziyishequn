'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRequireUser } from '@/components/front/UserAuthContext'
import { useMyReferral } from '@/components/front/referral/useMyReferral'
import { copyText, lineShareUrl } from '@/components/front/referral/referralClient'
import { LineIcon } from '@/components/front/referral/ShareCard'
import { SHARE_TEMPLATES, withReferral } from '@/lib/referral'
import { SITE_URL } from '@/lib/siteUrl'

const TEMPLATE_PATH: Record<string, string> = { general: '/', family: '/shop', quiz: '/sleep-quiz' }

/**
 * 會員中心・邀請親友。
 * 三步：選一段話 → 傳給 LINE 好友 → 看有幾位親友因您而來。
 * 文案刻意寫成分享、不提療效，客人才不會覺得像在推銷。
 */
export default function InvitePage() {
  const { user, loading } = useRequireUser()
  const { referral } = useMyReferral()
  const [tpl, setTpl] = useState(SHARE_TEMPLATES[0].key)
  const [text, setText] = useState('')

  const code = referral?.code
  const link = code ? withReferral(`${SITE_URL}${TEMPLATE_PATH[tpl] || '/'}`, code, 'invite') : ''
  useEffect(() => {
    const t = SHARE_TEMPLATES.find(x => x.key === tpl)
    if (t && link) setText(t.text(link))
  }, [tpl, link])

  if (loading || (user && !referral)) return <div className="py-20 text-center text-gray-600">載入中...</div>
  if (!user) return null

  const copy = async (v: string, ok: string) => { if (await copyText(v)) toast.success(ok); else toast.error('複製失敗，請長按手動複製') }
  const s = referral?.stats

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-16 sm:py-10">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/account" className="hover:text-green-700">會員中心</Link><span>›</span><span className="text-gray-700">邀請親友</span>
        </nav>

        <section className="rounded-3xl bg-gradient-to-br from-green-600 to-emerald-600 p-6 text-white shadow-lg shadow-green-100">
          <p className="text-[15px] text-green-50">邀請親友</p>
          <h1 className="mt-1 text-2xl font-bold leading-snug">把用得好的東西，<br className="sm:hidden" />分享給在乎的人 💚</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-green-50">您傳出去的連結會附上專屬推薦碼，親友點進來逛逛、註冊或下單，這裡都看得到。</p>
        </section>

        {!referral?.ready || !code ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <p className="font-bold text-gray-800">推薦功能準備中</p>
            <p className="mt-1 text-[15px] text-gray-600">很快就能使用，請稍後再回來看看 🙏</p>
          </section>
        ) : (
          <>
            {/* 成效 */}
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-900">因您而來的親友</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['👀', '點了連結', s?.visits ?? 0, '次'],
                  ['🙋', '註冊會員', s?.signups ?? 0, '位'],
                  ['🛍️', '下單的親友', s?.friends ?? 0, '位'],
                  ['🌱', '第一次購買', s?.new_customers ?? 0, '位'],
                ].map(([icon, label, n, unit]) => (
                  <div key={label as string} className="rounded-2xl bg-gray-50 p-3 text-center">
                    <p className="text-xl" aria-hidden>{icon}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{n}<span className="ml-0.5 text-sm font-semibold text-gray-500">{unit}</span></p>
                    <p className="text-[13px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 分享 */}
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm text-white">1</span>選一段話</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {SHARE_TEMPLATES.map(t => (
                  <button key={t.key} type="button" onClick={() => setTpl(t.key)} aria-pressed={tpl === t.key}
                    className={`rounded-full border-2 px-4 py-2 text-[15px] font-bold ${tpl === t.key ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>
                    {t.title}
                  </button>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="text-[13px] text-gray-500">可以改成您自己的話</span>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                  className="mt-1 w-full resize-none rounded-2xl border-2 border-gray-200 p-3 text-[15px] leading-relaxed focus:border-green-500 focus:outline-none" />
              </label>

              <h2 className="mt-5 text-lg font-bold text-gray-900"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-sm text-white">2</span>傳給親友</h2>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <a href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#06C755] text-[18px] font-bold text-white shadow-sm active:opacity-90">
                  <LineIcon /> 傳給 LINE 好友
                </a>
                <button type="button" onClick={() => copy(text, '已複製訊息，貼到 LINE 群組或簡訊就能傳')}
                  className="flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-gray-200 text-[16px] font-bold text-gray-700 active:bg-gray-50">
                  複製整段訊息
                </button>
              </div>
              <p className="mt-2 text-[13px] text-gray-500">傳到 LINE 群組（例如家人群組）也可以，點「傳給 LINE 好友」後選群組即可。</p>
            </section>

            {/* 專屬連結 */}
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">我的專屬連結</h2>
              <p className="mt-1 text-[13px] text-gray-500">推薦碼 <b className="font-mono text-base tracking-[0.2em] text-gray-900">{code}</b>　親友點這個連結進來，30 天內註冊或下單都算您推薦的</p>
              <div className="mt-3 flex items-stretch gap-2">
                <p className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3 py-3 font-mono text-[13px] text-gray-700">{withReferral(`${SITE_URL}/`, code, 'invite')}</p>
                <button type="button" onClick={() => copy(withReferral(`${SITE_URL}/`, code, 'invite'), '已複製連結')}
                  className="flex-shrink-0 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white">複製</button>
              </div>
            </section>

            {/* 小技巧 */}
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-bold text-amber-900">怎麼分享最自然？</h2>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-amber-900">
                <li>・傳給<b>有同樣需要</b>的家人朋友，比傳到大群組有用</li>
                <li>・說說<b>自己的使用感受</b>，比轉貼商品介紹更讓人放心</li>
                <li>・每月團購開團時<b>揪朋友一起跟</b>，一起湊免運</li>
                <li>・請不要寫「治療、改善疾病」這類字眼，分享心得就好 🙏</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
