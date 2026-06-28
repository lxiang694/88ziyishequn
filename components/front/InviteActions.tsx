'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  code: string
  /** LINE 官方帳號 Basic ID，例如 @123abcde */
  oaBasicId?: string
}

export default function InviteActions({ code, oaBasicId }: Props) {
  const [copied, setCopied] = useState(false)

  // 預先帶入邀請碼的訊息，朋友點開 LINE 後直接送出即可
  const prefill = `我要加入！邀請碼 ${code}`
  const oaMessageUrl = oaBasicId
    ? `https://line.me/R/oaMessage/${oaBasicId}/?${encodeURIComponent(prefill)}`
    : ''
  const addFriendUrl = oaBasicId ? `https://line.me/R/ti/p/${oaBasicId}` : ''

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('邀請碼已複製')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('複製失敗，請手動長按複製')
    }
  }

  return (
    <div className="space-y-4">
      {oaMessageUrl ? (
        <a
          href={oaMessageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-4 rounded-2xl transition-colors text-base shadow-lg shadow-green-200"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.631.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          一鍵加入 LINE（自動帶入邀請碼）
        </a>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          尚未設定官方帳號連結，請聯絡管理員。
        </div>
      )}

      {addFriendUrl && (
        <a
          href={addFriendUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-green-400 text-gray-700 hover:text-green-700 font-bold py-3 rounded-2xl transition-colors text-sm"
        >
          只先加入官方帳號（稍後再貼邀請碼）
        </a>
      )}

      {/* 邀請碼，按鈕無法自動帶入時的備援 */}
      <div className="bg-gray-50 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-2">
          若按鈕沒有自動帶入，請加入官方帳號後，把這組邀請碼貼給我們：
        </p>
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-2 bg-white border-2 border-dashed border-green-300 rounded-xl px-5 py-2.5 font-mono font-bold text-lg text-green-700 tracking-widest hover:bg-green-50 transition-colors"
        >
          {code}
          <span className="text-xs font-sans font-normal text-gray-400">
            {copied ? '已複製' : '點擊複製'}
          </span>
        </button>
      </div>
    </div>
  )
}
