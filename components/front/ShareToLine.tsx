'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function ShareToLine({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('連結已複製，可貼到任何地方分享')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('複製失敗，請手動複製網址')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 my-8">
      <p className="font-bold text-gray-700 mb-3 text-base">分享這篇給朋友</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={lineShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 rounded-xl transition-colors text-base"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.631.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.282.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          分享到 LINE
        </a>
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-green-400 text-gray-700 hover:text-green-700 font-bold py-3.5 rounded-xl transition-colors text-base"
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
      <p className="text-gray-600 text-[13px] mt-3 text-center">分享給家人朋友，一起重視健康</p>
    </div>
  )
}
