'use client'
import Link from 'next/link'
import { useUserAuth } from './UserAuthContext'

interface Props {
  /** 主標題 */
  title?: string
  /** 副說明 */
  message?: string
  /** 自訂好處清單 */
  benefits?: string[]
  /** 登入後要返回的頁面（預設目前頁） */
  next?: string
  /** 主題色 */
  theme?: 'green' | 'indigo' | 'amber' | 'emerald'
  /** 緊湊模式（用於頁尾） */
  compact?: boolean
}

const THEMES = {
  green: {
    bg: 'from-green-50 to-emerald-50',
    border: 'border-green-200',
    accent: 'text-green-700',
    button: 'bg-green-700 hover:bg-green-800',
    secondary: 'border-green-300 text-green-700 hover:bg-green-50',
  },
  indigo: {
    bg: 'from-indigo-50 to-blue-50',
    border: 'border-indigo-200',
    accent: 'text-indigo-700',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    secondary: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
  },
  amber: {
    bg: 'from-amber-50 to-orange-50',
    border: 'border-amber-200',
    accent: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700',
    secondary: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  emerald: {
    bg: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    accent: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    secondary: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  },
}

const DEFAULT_BENEFITS = [
  '查看歷史訂單與物流狀態',
  '結帳時自動帶入手機、門市、姓名',
  '一鍵再買一次過去訂購過的商品',
]

export default function LoginPrompt({
  title = '建議您註冊免費會員',
  message = '註冊只需 1 分鐘，下次使用會更便利',
  benefits = DEFAULT_BENEFITS,
  next,
  theme = 'green',
  compact = false,
}: Props) {
  const { user, loading } = useUserAuth()

  // Already logged in → don't show
  if (loading || user) return null

  const t = THEMES[theme]

  // Construct next URL (defaults to current path)
  const buildHref = (base: string) => {
    if (!next) return base
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}next=${encodeURIComponent(next)}`
  }

  if (compact) {
    return (
      <div className={`bg-gradient-to-br ${t.bg} border ${t.border} rounded-2xl p-4 my-6`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className={`font-bold ${t.accent} text-sm`}>👤 {title}</p>
            <p className="text-[13px] text-gray-600 mt-0.5">{message}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href={buildHref('/login')}
              className={`border-2 ${t.secondary} font-bold text-[13px] px-3 py-2 rounded-xl transition-colors whitespace-nowrap`}>
              登入
            </Link>
            <Link href={buildHref('/signup')}
              className={`${t.button} text-white font-bold text-[13px] px-3 py-2 rounded-xl transition-colors whitespace-nowrap`}>
              註冊會員
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br ${t.bg} border-2 ${t.border} rounded-2xl p-5 sm:p-6 my-6`}>
      <div className="flex items-start gap-4">
        <div className="text-4xl flex-shrink-0">👤</div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold ${t.accent} text-lg mb-1`}>{title}</p>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">{message}</p>
          <ul className="space-y-1 mb-4">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className={`${t.accent} flex-shrink-0`}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href={buildHref('/signup')}
              className={`flex-1 text-center ${t.button} text-white font-bold py-2.5 rounded-xl transition-colors text-sm`}>
              立即免費註冊
            </Link>
            <Link href={buildHref('/login')}
              className={`flex-1 text-center border-2 ${t.secondary} font-bold py-2.5 rounded-xl transition-colors text-sm`}>
              已有帳號？登入
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
