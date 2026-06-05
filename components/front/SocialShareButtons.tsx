'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  url: string
  title: string
  /** Section heading, e.g. "把睡眠自測分享給家人朋友" */
  heading?: string
  /** Subtext under heading */
  subtext?: string
  /** Optional accent color theme */
  theme?: 'green' | 'indigo' | 'amber'
}

const THEME_CLASSES = {
  green: 'border-green-100 bg-white',
  indigo: 'border-indigo-100 bg-white',
  amber: 'border-amber-100 bg-white',
}

export default function SocialShareButtons({
  url,
  title,
  heading = '把這個分享給家人朋友',
  subtext = '一起重視健康',
  theme = 'green',
}: Props) {
  const [copied, setCopied] = useState(false)

  // LINE 用通用 URL Scheme（手機自動開啟 LINE App，桌機開啟 LINE 桌面版）
  // 標題和網址分行，LINE 會自動把網址轉成可點擊預覽卡片
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${url}`)}`
  // Facebook 分享支援標題與網址
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      toast.success('連結已複製，可貼到任何地方分享')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('複製失敗，請手動複製網址')
    }
  }

  return (
    <div className={`rounded-2xl border-2 p-5 my-8 ${THEME_CLASSES[theme]}`}>
      <div className="text-center mb-4">
        <p className="font-bold text-gray-800 text-base">{heading}</p>
        {subtext && <p className="text-gray-400 text-xs mt-1">{subtext}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* LINE */}
        <a
          href={lineShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.631.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          分享到 LINE
        </a>

        {/* Facebook */}
        <a
          href={facebookShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#0e63d6] text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          分享到 Facebook
        </a>

        {/* Copy link */}
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-green-400 text-gray-700 hover:text-green-700 font-bold py-3 rounded-xl transition-colors text-sm"
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              已複製
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
              </svg>
              複製連結
            </>
          )}
        </button>
      </div>
    </div>
  )
}
